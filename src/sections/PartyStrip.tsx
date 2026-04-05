import { partyTable } from '../data';

const PartyStrip = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Party-wise Projection</h2>
        <p className="text-sm text-slate-300">
          Seats, vote share, and swing versus 2021 with party colours and symbols.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {partyTable.map((p) => (
          <article
            key={p.label}
            className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-md"
          >
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                    p.name === 'BJP'
                      ? 'bg-bjp/20 text-bjp'
                      : p.name === 'AITC' || p.name === 'ISF'
                      ? 'bg-tmc/20 text-tmc'
                      : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  {p.label.match(/[(](.*)[)]/)?.[1] ?? '●'}
                </span>
                <h3 className="text-sm font-semibold">{p.label.split('(')[0].trim()}</h3>
              </div>
              <span className="text-[11px] text-slate-400">{p.voteShare}%</span>
            </header>

            <p className="mt-3 text-lg font-semibold">
              {p.seats}{' '}
              <span className="text-xs font-normal text-slate-400">seats</span>
            </p>
            <p
              className={`mt-1 text-xs font-medium ${
                p.change > 0
                  ? 'text-emerald-400'
                  : p.change < 0
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {p.change > 0 ? '+' : ''}
              {p.change} vs 2021
            </p>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                style={{ width: `${Math.max(8, (p.seats / 294) * 100)}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default PartyStrip;
