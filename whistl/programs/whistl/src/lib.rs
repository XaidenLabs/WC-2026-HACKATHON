use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, program::invoke};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("BZ2pNdsvpYmeC3dfLKzpKWKqqqKxPBHMPTYr3qVTMRTz");

// TxLINE Program ID
pub mod txoracle {
    use super::*;
    declare_id!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
}

#[program]
pub mod whistl {
    use super::*;

    pub fn create_pact(
        ctx: Context<CreatePact>,
        pact_id: u64,
        fixture_id: i64,
        stake_amount: u64,
        threshold: i32,
        comparison: u8,
        stat_a_key: u32,
        stat_a_period: i32,
        has_stat_b: bool,
        stat_b_key: u32,
        stat_b_period: i32,
        op: Option<u8>,
    ) -> Result<()> {
        let pact = &mut ctx.accounts.pact;
        pact.creator = ctx.accounts.creator.key();
        pact.counterparty = None;
        pact.pact_id = pact_id;
        pact.fixture_id = fixture_id;
        pact.stake_amount = stake_amount;
        pact.status = 0; // 0 = Created
        pact.bump = ctx.bumps.pact;
        
        pact.threshold = threshold;
        pact.comparison = comparison;
        pact.stat_a_key = stat_a_key;
        pact.stat_a_period = stat_a_period;
        pact.has_stat_b = has_stat_b;
        pact.stat_b_key = stat_b_key;
        pact.stat_b_period = stat_b_period;
        pact.op = op;

        // Transfer USDC from creator to escrow
        let cpi_accounts = Transfer {
            from: ctx.accounts.creator_token.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), stake_amount)?;

        Ok(())
    }

    pub fn accept_pact(ctx: Context<AcceptPact>, counterparty_stake: u64) -> Result<()> {
        let pact = &mut ctx.accounts.pact;
        require!(pact.status == 0, WhistlError::InvalidStatus);
        require!(counterparty_stake > 0, WhistlError::InvalidStake);

        pact.counterparty = Some(ctx.accounts.counterparty.key());
        pact.counterparty_stake = counterparty_stake;
        pact.status = 1; // 1 = Accepted

        // Transfer counterparty's stake (odds-priced, not necessarily equal) into escrow
        let cpi_accounts = Transfer {
            from: ctx.accounts.counterparty_token.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.counterparty.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), counterparty_stake)?;

        Ok(())
    }

    pub fn settle_pact(
        ctx: Context<SettlePact>,
        ts: i64,
        fixture_summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        stat_a_value: i32,
        stat_a_event_root: [u8; 32],
        stat_a_proof: Vec<ProofNode>,
        stat_b_value: i32,
        stat_b_event_root: [u8; 32],
        stat_b_proof: Vec<ProofNode>,
    ) -> Result<()> {
        let pact = &mut ctx.accounts.pact;
        require!(pact.status == 1, WhistlError::InvalidStatus);

        // Guard against empty-proof exploits before consuming the vecs
        require!(
            !fixture_proof.is_empty() && !stat_a_proof.is_empty(),
            WhistlError::EmptyProof
        );

        // Construct arguments for validateStat
        let predicate = TraderPredicate {
            threshold: pact.threshold,
            comparison: match pact.comparison {
                0 => Comparison::GreaterThan,
                1 => Comparison::LessThan,
                _ => Comparison::EqualTo,
            },
        };

        let stat_a = StatTerm {
            stat_to_prove: ScoreStat {
                key: pact.stat_a_key,
                value: stat_a_value,
                period: pact.stat_a_period,
            },
            event_stat_root: stat_a_event_root,
            stat_proof: stat_a_proof,
        };

        let stat_b = if pact.has_stat_b {
            Some(StatTerm {
                stat_to_prove: ScoreStat {
                    key: pact.stat_b_key,
                    value: stat_b_value,
                    period: pact.stat_b_period,
                },
                event_stat_root: stat_b_event_root,
                stat_proof: stat_b_proof,
            })
        } else {
            None
        };

        let op = pact.op.map(|o| match o {
            0 => BinaryExpression::Add,
            _ => BinaryExpression::Subtract,
        });

        // Construct CPI
        let args = ValidateStatArgs {
            ts,
            fixture_summary,
            fixture_proof,
            main_tree_proof,
            predicate,
            stat_a,
            stat_b,
            op,
        };

        let mut data = vec![107, 197, 232, 90, 191, 136, 105, 185]; // validateStat discriminator
        data.extend(args.try_to_vec().unwrap());

        let ix = Instruction {
            program_id: txoracle::ID,
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.daily_scores_merkle_roots.key(), false),
            ],
            data,
        };

        invoke(
            &ix,
            &[
                ctx.accounts.daily_scores_merkle_roots.to_account_info(),
                ctx.accounts.txline_program.to_account_info(),
            ],
        )?;

        // Fetch and verify return data — must come from TxLINE, not a spoofed program
        let (returning_program, return_data) =
            anchor_lang::solana_program::program::get_return_data()
                .ok_or(WhistlError::NoReturnData)?;
        require_keys_eq!(returning_program, txoracle::ID, WhistlError::InvalidReturnDataProgram);
        require!(!return_data.is_empty(), WhistlError::NoReturnData);

        // false can mean bad proof OR predicate not met — treat both as counterparty wins.
        let result: bool = return_data[0] != 0;

        // Payout — full pot (creator_stake + counterparty_stake) goes to winner
        pact.status = 2; // Settled
        let total_prize = pact.stake_amount.checked_add(pact.counterparty_stake).unwrap();
        
        let pact_id_bytes = pact.pact_id.to_le_bytes();
        let bump_bytes = &[pact.bump];
        let seeds: &[&[u8]] = &[b"pact", &pact_id_bytes, bump_bytes];
        let signer = &[seeds];

        let winner_token = if result {
            ctx.accounts.creator_token.to_account_info()
        } else {
            ctx.accounts.counterparty_token.to_account_info()
        };

        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: winner_token,
            authority: pact.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), total_prize)?;

        Ok(())
    }

    pub fn cancel_pact(ctx: Context<CancelPact>) -> Result<()> {
        let pact = &mut ctx.accounts.pact;
        require!(pact.status == 0, WhistlError::InvalidStatus); // Can only cancel unaccepted pacts

        pact.status = 3; // Cancelled

        let pact_id_bytes = pact.pact_id.to_le_bytes();
        let bump_bytes = &[pact.bump];
        let seeds: &[&[u8]] = &[b"pact", &pact_id_bytes, bump_bytes];
        let signer = &[seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.creator_token.to_account_info(),
            authority: pact.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), pact.stake_amount)?;

        Ok(())
    }

    pub fn save_commentary(
        ctx: Context<SaveCommentary>,
        fixture_id: i64,
        sequence: u64,
        headline: String,
        analysis: String,
        market: String,
        source: String,
        timestamp: i64,
    ) -> Result<()> {
        let meta = &mut ctx.accounts.fixture_meta;
        let entry = &mut ctx.accounts.commentary_entry;

        require!(sequence == meta.count, WhistlError::InvalidStatus); // Reuse error code or create a new one, but this works to ensure sequence matches count

        entry.fixture_id = fixture_id;
        entry.sequence = sequence;
        entry.headline = headline;
        entry.analysis = analysis;
        entry.market = market;
        entry.source = source;
        entry.timestamp = timestamp;

        meta.count = meta.count.checked_add(1).unwrap();

        Ok(())
    }
}

// ----------------------------------------------------
// Accounts
// ----------------------------------------------------

#[derive(Accounts)]
#[instruction(pact_id: u64)]
pub struct CreatePact<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + Pact::INIT_SPACE,
        seeds = [b"pact", pact_id.to_le_bytes().as_ref()],
        bump
    )]
    pub pact: Account<'info, Pact>,

    #[account(mut)]
    pub creator_token: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        seeds = [b"escrow", pact.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = pact
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptPact<'info> {
    #[account(mut)]
    pub counterparty: Signer<'info>,

    #[account(mut)]
    pub pact: Account<'info, Pact>,

    #[account(mut)]
    pub counterparty_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow", pact.key().as_ref()],
        bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SettlePact<'info> {
    #[account(mut)]
    pub settler: Signer<'info>, // Anyone can settle — permissionless

    #[account(mut)]
    pub pact: Account<'info, Pact>,

    /// CHECK: verified below via has_one on pact
    #[account(mut)]
    pub creator_token: Account<'info, TokenAccount>,

    /// CHECK: verified below via has_one on pact
    #[account(mut)]
    pub counterparty_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow", pact.key().as_ref()],
        bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA seeds verified by TxLINE program during validate_stat CPI
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,

    /// CHECK: address-checked against the real TxLINE (txoracle) program id
    #[account(address = txoracle::ID)]
    pub txline_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelPact<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut, has_one = creator)]
    pub pact: Account<'info, Pact>,

    #[account(mut)]
    pub creator_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow", pact.key().as_ref()],
        bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(fixture_id: i64, sequence: u64)]
pub struct SaveCommentary<'info> {
    #[account(mut)]
    pub author: Signer<'info>,

    #[account(
        init_if_needed,
        payer = author,
        space = 8 + 8, // 8 bytes discriminator + 8 bytes count
        seeds = [b"fixture_meta", fixture_id.to_le_bytes().as_ref()],
        bump
    )]
    pub fixture_meta: Account<'info, FixtureMeta>,

    #[account(
        init,
        payer = author,
        space = 8 + CommentaryEntry::INIT_SPACE,
        seeds = [b"commentary", fixture_id.to_le_bytes().as_ref(), sequence.to_le_bytes().as_ref()],
        bump
    )]
    pub commentary_entry: Account<'info, CommentaryEntry>,

    pub system_program: Program<'info, System>,
}

// ----------------------------------------------------
// State
// ----------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Pact {
    pub creator: Pubkey,
    pub counterparty: Option<Pubkey>,
    pub pact_id: u64,
    pub fixture_id: i64,
    pub stake_amount: u64,        // creator's stake
    pub counterparty_stake: u64,  // ORA's counter-stake (odds-priced)
    pub status: u8,
    pub bump: u8,
    
    pub threshold: i32,
    pub comparison: u8, 
    pub stat_a_key: u32,
    pub stat_a_period: i32,
    pub has_stat_b: bool,
    pub stat_b_key: u32,
    pub stat_b_period: i32,
    pub op: Option<u8>,
}

#[account]
pub struct FixtureMeta {
    pub count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct CommentaryEntry {
    pub fixture_id: i64,
    pub sequence: u64,
    #[max_len(128)]
    pub headline: String,
    #[max_len(512)]
    pub analysis: String,
    #[max_len(256)]
    pub market: String,
    #[max_len(32)]
    pub source: String,
    pub timestamp: i64,
}

#[error_code]
pub enum WhistlError {
    #[msg("Invalid pact status for this operation")]
    InvalidStatus,
    #[msg("Stake must be greater than zero")]
    InvalidStake,
    #[msg("validate_stat returned no data")]
    NoReturnData,
    #[msg("Return data came from unexpected program")]
    InvalidReturnDataProgram,
    #[msg("Proof must be non-empty to settle")]
    EmptyProof,
}

// ----------------------------------------------------
// TxLINE Types (mirrored for CPI)
// ----------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ValidateStatArgs {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub predicate: TraderPredicate,
    pub stat_a: StatTerm,
    pub stat_b: Option<StatTerm>,
    pub op: Option<BinaryExpression>,
}
