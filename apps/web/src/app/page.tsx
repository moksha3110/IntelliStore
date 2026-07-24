import Link from 'next/link';

const services = [
  { name: 'API Gateway', port: 4000, status: 'scaffolded' },
  { name: 'Auth Service', port: 4001, status: 'live' },
  { name: 'Metadata Service', port: 4002, status: 'live' },
  { name: 'Storage Service', port: 4003, status: 'live' },
  { name: 'Replication Service', port: 4004, status: 'live' },
  { name: 'AI Analytics Service', port: 4005, status: 'live' },
  { name: 'Notification Service', port: 4006, status: 'scaffolded' },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950">
      <section className="bg-brand-gradient">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-200">
            Milestone 9 · AI Storage Analytics Dashboard
          </p>
          <h1 className="mt-4 text-4xl font-bold text-white sm:text-5xl">IntelliStore</h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-100">
            AI-powered distributed storage platform — chunked uploads, automatic
            replication, self-healing nodes, and AI-driven hot/cold tiering.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-md bg-white px-5 py-2.5 font-medium text-brand-900 hover:bg-brand-50"
          >
            Get started
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-xl font-semibold text-slate-100">Platform services</h2>
        <p className="mt-1 text-sm text-slate-400">
          Auth, metadata, chunked storage, replication (with node heartbeats and
          self-healing), and AI analytics are live end to end. The API gateway and
          notification service are still scaffolded skeletons.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="rounded-xl border border-brand-800/60 bg-brand-950/40 p-5 shadow-lg shadow-brand-950/40 transition hover:border-brand-500/60"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-100">{service.name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    service.status === 'live'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-brand-500/20 text-brand-300'
                  }`}
                >
                  {service.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">localhost:{service.port}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
