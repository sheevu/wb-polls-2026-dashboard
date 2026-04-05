const Compass3D = () => {
  return (
    <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] items-center">
      <div className="relative h-72 md:h-96 overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
        <div className="flex h-full items-center justify-center text-xs text-slate-400">
          Embed 3D compass (Spline / Three.js) here.
        </div>
      </div>
      <div className="space-y-3 text-sm">
        <h2 className="text-xl font-semibold">Interactive 3D Compass</h2>
        <p className="text-slate-300">
          Rotate your device or drag to explore BJP vs AITC balance across North Bengal, Junglemahal,
          Gangetic plains, Kolkata and more.
        </p>
        <p className="text-slate-400">
          The compass is driven by Sudarshan AI's district-wise scenario model calibrated to BJP 165,
          AITC 115, INC 8, Left/ISF 5 and Others 1 seats statewide.
        </p>
      </div>
    </div>
  );
};

export default Compass3D;
