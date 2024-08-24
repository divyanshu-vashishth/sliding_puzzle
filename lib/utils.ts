import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type PuzzleState = (number | null)[]

export function createPuzzle(size: number): PuzzleState {
  const tiles: PuzzleState = Array.from({ length: size * size - 1 }, (_, i) => i + 1)
  tiles.push(null)
  return shuffleArray(tiles)
}

export function checkWin(state: PuzzleState): boolean {
  return state.every((tile, index) => 
    (index === state.length - 1 && tile === null) || tile === index + 1
  )
}

export function moveTile(state: PuzzleState, index: number): PuzzleState {
  const newState = [...state]
  const emptyIndex = newState.indexOf(null)
  
  if (emptyIndex !== -1 && isAdjacent(index, emptyIndex, Math.sqrt(state.length))) {
    [newState[index], newState[emptyIndex]] = [newState[emptyIndex], newState[index]]
    return newState
  }
  
  return state // Return original state if move is invalid
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function isAdjacent(index1: number, index2: number, size: number): boolean {
  const row1 = Math.floor(index1 / size)
  const col1 = index1 % size
  const row2 = Math.floor(index2 / size)
  const col2 = index2 % size
  
  return (
    (Math.abs(row1 - row2) === 1 && col1 === col2) ||
    (Math.abs(col1 - col2) === 1 && row1 === row2)
  )
}

export function isSolvable(puzzle: PuzzleState): boolean {
  let inversionCount = 0;
  const size = Math.sqrt(puzzle.length);

  for (let i = 0; i < puzzle.length - 1; i++) {
    for (let j = i + 1; j < puzzle.length; j++) {
      if (puzzle[i] !== null && puzzle[j] !== null && puzzle[i]! > puzzle[j]!) {
        inversionCount++;
      }
    }
  }

  const emptyTileRow = Math.floor(puzzle.indexOf(null) / size);

  if (size % 2 === 1) {
    return inversionCount % 2 === 0;
  } else {
    return (inversionCount + emptyTileRow) % 2 === 1;
  }
}