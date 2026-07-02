import EventSource from "eventsource";
import { EventEmitter } from "events";

export class TxOddsStream extends EventEmitter {
  private url: string;
  private es: EventSource | null = null;

  constructor(url: string = "https://api.txodds.com/v1/sse/scores") {
    super();
    this.url = url;
  }

  connect() {
    console.log(`[TxODDS] Connecting to stream at ${this.url}...`);
    this.es = new EventSource(this.url);

    this.es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[TxODDS] Received match update for fixture ${data.fixtureId}`);
        this.emit("match_update", data);
      } catch (err) {
        console.error("[TxODDS] Error parsing event data", err);
      }
    };

    this.es.onerror = (err) => {
      console.error("[TxODDS] Stream error:", err);
    };
  }

  disconnect() {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }
}
