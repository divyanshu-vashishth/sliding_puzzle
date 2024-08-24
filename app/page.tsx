import PuzzleGame from "./_components/puzzleGame";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-[url('/background.jpg')] bg-cover bg-center flex items-center justify-center p-4">
      <div className="w-full max-w-7xl bg-opacity-90 rounded-lg  overflow-hidden">
        <PuzzleGame />
      </div>
    </main>
  );
}