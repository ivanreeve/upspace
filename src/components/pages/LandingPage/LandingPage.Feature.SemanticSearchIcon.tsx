export function SemanticSearchIcon() {
  return (
    <div className="relative flex h-36 w-full items-center justify-center before:absolute before:left-0 before:right-0 before:top-1/2 before:h-2 before:-translate-y-1/2 before:bg-secondary before:content-[''] before:-z-10">
      <div className="relative w-36 h-36 after:absolute after:inset-0 after:bg-red-500 after:content-[''] after:-z-10 after:rounded-md">
        <div className="absolute inset-4 bg-amber-300 z-10 rounded-md"></div>
      </div>
    </div>
  );
}