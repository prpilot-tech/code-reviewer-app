function FloatingBlobs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="animate-blob absolute -top-40 -left-32 size-96 rounded-full bg-blue-400/30 blur-3xl dark:bg-blue-500/15" />
      <div className="animate-blob absolute top-1/3 -right-32 size-[26rem] rounded-full bg-violet-400/30 blur-3xl [animation-delay:-7s] dark:bg-violet-500/15" />
      <div className="animate-blob absolute -bottom-40 left-1/4 size-96 rounded-full bg-rose-300/30 blur-3xl [animation-delay:-14s] dark:bg-rose-500/10" />
    </div>
  );
}

export default FloatingBlobs;
