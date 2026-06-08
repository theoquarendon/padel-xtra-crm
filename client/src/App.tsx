import Pipeline from './components/Pipeline';

export default function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <header className="flex-shrink-0 bg-padel-navy px-5 md:px-8 py-4 md:py-5 border-b-2 border-padel-green shadow-sm flex items-center justify-between">
        <h1 className="font-raleway font-bold text-white tracking-[0.14em] text-base md:text-xl uppercase select-none">
          Padel Xtra — Property Pipeline
        </h1>
        <span className="font-raleway font-bold text-white text-xs md:text-sm tracking-[0.14em] uppercase opacity-60 select-none">
          TQRE
        </span>
      </header>
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        <Pipeline />
      </main>
    </div>
  );
}
