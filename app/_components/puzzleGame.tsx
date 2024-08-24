'use client'
import React, { useState, useCallback, useEffect } from 'react'
import usePartySocket from 'partysocket/react'
import { moveTile, checkWin } from '@/lib/utils'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toaster, toast } from 'sonner'
import Image from 'next/image'




const PuzzleGame: React.FC = () => {
  const [gameState, setGameState] = useState<(number | null)[]>([])
  const [opponentState, setOpponentState] = useState<(number | null)[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [moves, setMoves] = useState(0)
  const [opponentMoves, setOpponentMoves] = useState(0)
  const [isWon, setIsWon] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [opponentName, setOpponentName] = useState('')
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showShareSection, setShowShareSection] = useState(false)
  const [roomNameInput, setRoomNameInput] = useState('')
  const [joinRoomInput, setJoinRoomInput] = useState('')
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false)
  const [visualHint, setVisualHint] = useState<number | null>(null)
  const [winner, setWinner] = useState<string>('')

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST!,
    room: roomId || "lobby",
    onOpen: () => setIsConnected(true),
    onClose: () => {
      setIsConnected(false);
      toast.error("Disconnected from server. Please refresh the page.");
    },
    onMessage(event) {
      const data = JSON.parse(event.data as string)
      console.log("Received message:", JSON.stringify(data, null, 2));
      switch (data.type) {
        case 'gameCreated':
          setRoomId(data.roomId);
          setImageUrl(data.imageUrl);
          setGameState(data.initialState);
          setPlayerId(data.playerId);
          setPlayerName(data.playerName);
          setIsWaitingForOpponent(true);
          break;
        case 'gameJoined':
          setRoomId(data.roomId);
          setImageUrl(data.imageUrl);
          setGameState(data.initialState);
          setPlayerId(data.playerId);
          setPlayerName(data.playerName);
          if (data.opponentName) setOpponentName(data.opponentName);
          setIsWaitingForOpponent(false);
          setIsGameStarted(true);
          break;
        case 'gameStart':
          setIsGameStarted(true);
          setIsWaitingForOpponent(false);
          if (data.players) {
            const players = Object.entries(data.players as Record<string, { name: string, state: (number | null)[] }>);
            players.forEach(([id, player]) => {
              if (id === playerId) {
                setGameState(player.state);
              } else {
                setOpponentName(player.name);
                setOpponentState(player.state);
              }
            });
          }
          break;
        case 'gameUpdate':
          if (data.playerId === playerId) {
            setGameState(data.state);
            setMoves(data.moves);
          } else {
            setOpponentState(data.state);
            setOpponentMoves(data.moves);
          }
          setVisualHint(data.visualHint);
          break;
        case 'gameWon':
          setIsWon(true);
          setWinner(data.winner);
          break;
        case 'playerDisconnected':
          toast.error(`${data.playerName} has disconnected.`);
          break;
      }
    },
  })

  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);

  const handleTileClick = useCallback((index: number) => {
    if (isWon) return;
    const newState = moveTile(gameState, index);
    if (newState !== gameState) {
      setGameState(newState);
      const newMoves = moves + 1;
      setMoves(newMoves);
      socket.send(JSON.stringify({
        type: 'updateGame',
        state: newState,
        moves: newMoves,
        visualHint: index
      }));
      if (checkWin(newState)) {
        setIsWon(true);
        socket.send(JSON.stringify({ type: 'gameWon', winner: playerName }));
      }
    }
  }, [gameState, isWon, socket, playerName, moves]);

  const createGame = () => {
    const newRoomId = `${roomNameInput}-${Math.random().toString(36).substring(2, 7)}`
    setRoomId(newRoomId)
    socket.send(JSON.stringify({ type: 'createGame', roomId: newRoomId, playerName }))
    setShowShareSection(true)
  }

  const joinGame = (roomIdToJoin: string = joinRoomInput.trim()) => {
    if (roomIdToJoin) {
      setRoomId(roomIdToJoin)
      socket.send(JSON.stringify({ type: 'joinGame', roomId: roomIdToJoin, playerName }))
    }
  }

  const shareRoomId = () => {
    navigator.clipboard.writeText(roomId)
    toast.success('Room ID copied to clipboard')
  }

  const renderPuzzleBoard = (state: (number | null)[], isOpponent: boolean, hintIndex: number | null) => {
    if (!state || state.length === 0) {
      return <div>Loading puzzle...</div>;
    }

    return (
      <div className='grid grid-cols-3 gap-1 w-full aspect-square bg-black p-1 rounded-lg'>
        {state.map((tile, index) => (
          <div
            key={index}
            className={`w-full h-full ${tile === null ? 'bg-gray-800' : ''} 
                      ${index === hintIndex ? 'ring-2 ring-blue-500' : ''}
                      relative overflow-hidden transition-all duration-300 ease-in-out
                      ${!isOpponent && 'hover:brightness-110 cursor-pointer'}`}
            onClick={() => !isOpponent && handleTileClick(index)}
          >
            {tile !== null && imageUrl && (
              <div
                className='absolute inset-0 bg-cover bg-center'
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: '300%',
                  backgroundPosition: `${((tile - 1) % 3) * 50}% ${Math.floor((tile - 1) / 3) * 50}%`
                }}
              >
                <span className="absolute top-1 left-1 bg-black bg-opacity-50 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold text-white">
                  {tile}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (!playerName) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-white">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold mb-4">Welcome to Puzzle Challenge</h1>
          <Input
            type="text"
            placeholder="Enter your name"
            className="mb-4"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <Button
            onClick={() => {
              if (nameInput.trim()) {
                setPlayerName(nameInput.trim())
              }
            }}
            variant={'secondary'}
            className="w-full"
          >
            Set Name
          </Button>
        </div>
      </div>
    )
  }

  if (!isGameStarted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-white">
        <div className="bg-gray-900 p-8 rounded-lg shadow-lg w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6 text-center">Sliding Puzzle Game</h1>
          {!showShareSection ? (
            <>
              <Input
                type="text"
                placeholder="Enter room name"
                className="mb-4"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
              />
              <Button
                onClick={createGame}
                className="w-full mb-4"
                disabled={!roomNameInput.trim()}
                variant={'secondary'}
              >
                Create Room
              </Button>
              <Input
                type="text"
                placeholder="Enter Room ID to join"
                className="mb-4"
                value={joinRoomInput}
                onChange={(e) => setJoinRoomInput(e.target.value)}
              />
              <Button
                onClick={() => joinGame(joinRoomInput)}
                className="w-full"
                disabled={!joinRoomInput.trim()}
                variant={'secondary'}
              >
                Join Room
              </Button>
            </>
          ) : (
            <div className="text-center">
              <p className="mb-4">Share this Room ID with your opponent:</p>
              <div className="flex mb-4">
                <Input
                  type="text"
                  value={roomId}
                  readOnly
                  className="rounded-r-none"
                />
                <Button onClick={shareRoomId} className="rounded-l-none">
                  Copy
                </Button>
              </div>
              {!isWaitingForOpponent && (
                <Button
                  onClick={() => joinGame(roomId)}
                  className="w-full"
                  variant={'secondary'}
                >
                  Join Your Room
                </Button>
              )}
              {isWaitingForOpponent && (
                <p>Waiting for opponent to join...</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className='flex bg-gray-800/60 flex-col items-center justify-center p-8 text-white'>
      <Toaster />
      <h1 className="text-3xl font-bold mb-6 text-center">
        Sliding Puzzle Challenge
      </h1>

      {imageUrl && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-2">Full Image Preview:</h3>
          <Image src={imageUrl} alt="Puzzle" className="object-cover rounded-lg shadow-md" width={256} height={256} />
        </div>
      )}

      <div className='flex flex-col lg:flex-row justify-center items-start w-full gap-8'>
        <div className='flex-1 w-full max-w-md'>
          <h2 className="text-2xl font-semibold mb-4">Your Puzzle ({playerName})</h2>
          {renderPuzzleBoard(gameState, false, visualHint)}
          <p className='mt-4 text-lg'>Your Moves: <span className="font-bold">{moves}</span></p>
        </div>
        <div className='flex-1 w-full max-w-md'>
          <h2 className="text-2xl font-semibold mb-4">Opponent's Puzzle ({opponentName})</h2>
          {renderPuzzleBoard(opponentState, true, visualHint)}
          <p className='mt-4 text-lg'>Opponent's Moves: <span className="font-bold">{opponentMoves}</span></p>
        </div>
      </div>

      {isWon && (
        <div className="mt-8 w-full max-w-2xl bg-green-500 p-4 rounded-lg text-center">
          <h3 className="text-2xl font-bold mb-2">
            {winner === playerName ? "You won!" : `${winner} won!`}
          </h3>
          <p className="text-xl">
            {gameState === opponentState ? "It&apos;s a tie!" : `Congratulations to ${winner}!`}
          </p>
        </div>
      )}
    </div>
  )
}

export default PuzzleGame