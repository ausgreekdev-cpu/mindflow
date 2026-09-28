import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room) {}

  async onConnect(connection: Party.Connection) {
    return onConnect(connection, this.room, {
      persist: false,
    });
  }
}
