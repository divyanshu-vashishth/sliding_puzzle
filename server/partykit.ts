import type * as Party from "partykit/server";
import { createPuzzle, checkWin, isSolvable } from "../lib/utils";
import { createApi } from 'unsplash-js';

export default class PuzzleGame implements Party.Server {
  gameState: {
    imageUrl: string;
    initialState: (number | null)[];
    players: Record<string, { state: (number | null)[]; moves: number; name: string }>;
    isGameStarted: boolean;
    winner: string | null;
  };

  constructor(readonly room: Party.Room) {
    this.gameState = {
      imageUrl: "",
      initialState: [],
      players: {},
      isGameStarted: false,
      winner: null,
    };
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Do nothing on connect, wait for specific actions
  }

  async onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);
    console.log("Received message:", data, "from", sender.id);

    switch (data.type) {
      case "createGame":
        await this.createGame(sender, data.playerName, data.roomId);
        break;
      case "joinGame":
        await this.joinGame(sender, data.playerName, data.roomId);
        break;
      case "updateGame":
        await this.updateGame(data.state, sender.id);
        break;
      case "gameWon":
        this.gameState.winner = data.winner;
        this.room.broadcast(JSON.stringify({ type: "gameWon", winner: data.winner }));
        break;
      case "gameStart":
        this.gameState.isGameStarted = true;
        this.room.broadcast(JSON.stringify({
          type: "gameStart",
          players: {
            [sender.id]: { name: data.playerName, state: this.gameState.initialState },
            [Object.keys(this.gameState.players)[0]]: { name: this.gameState.players[Object.keys(this.gameState.players)[0]].name, state: this.gameState.initialState },
          },
          currentTurn: sender.id,
        }));
        break;
    }
  }

  async initializeGame() {
    this.gameState.imageUrl = await this.fetchRandomImage();
    let puzzle;
    do {
      puzzle = createPuzzle(3);
    } while (!isSolvable(puzzle));
    this.gameState.initialState = puzzle;
  }

  async createGame(sender: Party.Connection, playerName: string, roomId: string) {
    if (!this.gameState.imageUrl) {
      await this.initializeGame();
    }

    this.gameState.players[sender.id] = { state: this.gameState.initialState, moves: 0, name: playerName };

    sender.send(JSON.stringify({
      type: "gameCreated",
      roomId: roomId,
      imageUrl: this.gameState.imageUrl,
      initialState: this.gameState.initialState,
      playerId: sender.id,
      playerName,
    }));
  }

  async joinGame(sender: Party.Connection, playerName: string, roomId: string) {
    if (Object.keys(this.gameState.players).length >= 2) {
      sender.send(JSON.stringify({ type: "gameError", message: "Game is full" }));
      return;
    }

    if (!this.gameState.imageUrl) {
      await this.initializeGame();
    }

    this.gameState.players[sender.id] = {
      state: this.gameState.initialState,
      moves: 0,
      name: playerName,
    };

    const players = Object.entries(this.gameState.players);
    const isSecondPlayer = players.length === 2;

    sender.send(JSON.stringify({
      type: "gameJoined",
      roomId: roomId,
      imageUrl: this.gameState.imageUrl,
      initialState: this.gameState.initialState,
      playerId: sender.id,
      playerName,
      opponentName: isSecondPlayer ? players[0][1].name : undefined,
    }));

    if (isSecondPlayer) {
      this.gameState.isGameStarted = true;
      this.room.broadcast(JSON.stringify({
        type: "gameStart",
        players: {
          [players[0][0]]: { name: players[0][1].name, state: this.gameState.initialState },
          [players[1][0]]: { name: players[1][1].name, state: this.gameState.initialState },
        },
      }));
    }
  }

  async updateGame(state: (number | null)[], playerId: string) {
    if (!this.gameState.isGameStarted) return;

    this.gameState.players[playerId].state = state;
    this.gameState.players[playerId].moves++;

    this.room.broadcast(JSON.stringify({
      type: "gameUpdate",
      playerId,
      state,
      moves: this.gameState.players[playerId].moves,
    }));

    if (checkWin(state)) {
      this.gameState.winner = this.gameState.players[playerId].name;
      this.room.broadcast(JSON.stringify({ type: "gameWon", winner: this.gameState.players[playerId].name }));
    }
  }

  async fetchRandomImage(): Promise<string> {
    // Implement your image fetching logic here
    try {
      const unsplash = createApi({
        accessKey: process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY!,
        fetch: fetch,
      });
      const result = await unsplash.photos.getRandom({
        query: 'puzzle',
        orientation: 'squarish'
      });
      if (result.type === 'error') {
        throw new Error('Failed to fetch image from Unsplash');
      }
      if (Array.isArray(result.response)) {
        return result.response[0].urls.regular;
      }
      return result.response.urls.regular;
    } catch (error) {
      console.error('Error fetching image:', error);
      return 'https://via.placeholder.com/300?text=Puzzle+Image';
    }
  }

  async onClose(connection: Party.Connection): Promise<void> {
    const disconnectedPlayer = this.gameState.players[connection.id];
    if (disconnectedPlayer) {
      delete this.gameState.players[connection.id];
      this.room.broadcast(JSON.stringify({
        type: "playerDisconnected",
        playerName: disconnectedPlayer.name
      }));
    }
  }
}