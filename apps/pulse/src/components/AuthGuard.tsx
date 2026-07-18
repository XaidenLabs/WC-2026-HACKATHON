export default function AuthGuard({ children }: { children: React.ReactNode }) {
  // Match discovery, commentary and Hi-Lo are intentionally public. Individual
  // social or wallet actions ask for sign-in at the moment they need it.
  return <>{children}</>;
}
