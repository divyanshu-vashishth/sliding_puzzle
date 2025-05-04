import type * as Party from "partykit/server";
import { createPuzzle, checkWin, isSolvable } from "../lib/utils";
import { createApi } from 'unsplash-js';

interface BetInfo {
  amount: number;
  transactionId: string;
  isPaid: boolean;
}

export default class PuzzleGame implements Party.Server {
  gameState: {
    imageUrl: string;
    initialState: (number | null)[];
    players: Record<string, { 
      state: (number | null)[]; 
      moves: number; 
      name: string;
      bet?: BetInfo;
    }>;
    isGameStarted: boolean;
    winner: string | null;
    totalBetAmount: number;
    areBetsLocked: boolean;
  };

  constructor(readonly room: Party.Room) {
    this.gameState = {
      imageUrl: "",
      initialState: [],
      players: {},
      isGameStarted: false,
      winner: null,
      totalBetAmount: 0,
      areBetsLocked: false
    };
  }

  async onConnect(conn: Party.Connection) {
    console.log("New connection:", conn.id);   
  }

  async onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);
    console.log("Received message:", data, "from", sender.id);

    switch (data.type) {
      case "createGame":
        await this.createGame(sender, data.playerName, data.roomId);
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
      case "joinGame":
        await this.joinGame(sender, data.playerName, data.roomId);
        break;
      case "updateGame":
        await this.updateGame(data.state, sender.id);
        break;
      case "gameWon":
        this.gameState.winner = data.winner;
        await this.handleWinnerPayout(data.winner);
        this.room.broadcast(JSON.stringify({ 
          type: "gameWon", 
          winner: data.winner 
        }));
        break;
      case "playerDisconnected":
        break;
      case "placeBet":
        await this.placeBet(sender, data.betAmount, data.transactionId);
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

  async placeBet(sender: Party.Connection, betAmount: number, transactionId: string) {
    if (this.gameState.areBetsLocked) {
      sender.send(JSON.stringify({ 
        type: "betError", 
        message: "Betting is locked for this game" 
      }));
      return;
    }

    this.gameState.players[sender.id].bet = {
      amount: betAmount,
      transactionId,
      isPaid: true
    };

    this.gameState.totalBetAmount += betAmount;

    // Check if both players have placed their bets
    const players = Object.values(this.gameState.players);
    if (players.length === 2 && players.every(p => p.bet?.isPaid)) {
      this.gameState.areBetsLocked = true;
      this.room.broadcast(JSON.stringify({
        type: "betsLocked",
        totalBetAmount: this.gameState.totalBetAmount
      }));
    }

    this.room.broadcast(JSON.stringify({
      type: "betPlaced",
      playerId: sender.id,
      betAmount,
      totalBetAmount: this.gameState.totalBetAmount
    }));
  }

  async handleWinnerPayout(winnerName: string) {
    const totalBetAmount = this.gameState.totalBetAmount;
    const winnerShare = totalBetAmount * 0.9; // Winner gets 90% of total bet

    const winner = Object.entries(this.gameState.players).find(
      ([_, player]) => player.name === winnerName
    );

    if (winner) {
      this.room.broadcast(JSON.stringify({
        type: "payoutComplete",
        winner: winnerName,
        amount: winnerShare
      }));
    }
  }
}