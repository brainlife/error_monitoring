import type { MonitoredResourceHealth } from '../api';

export default function DockerHealthPanel({ resources }: { resources: MonitoredResourceHealth[] }) {
  const hosts = ['prod-api-1', 'prod-api-2'];
  return <section className="space-y-4" aria-label="Docker container health">
    <h2 className="text-sm font-bold text-white">API host Docker containers</h2>
    <p className="text-xs text-text-muted">Updated by the prod collector every minute. Refresh loads its latest report.</p>
    {hosts.map(name => {
      const resource = resources.find(r => r.resource_name === name);
      const check = resource?.docker_check;
      const docker = resource?.docker;
      const date = check?.check_date ? new Date(check.check_date).getTime() : NaN;
      const stale = !Number.isFinite(date) || Date.now() - date > 180000 || check?.stale;
      const status = stale ? 'unknown' : check?.status || 'unknown';
      return <div key={name} className="glass rounded-2xl border border-border-glass p-5 space-y-3">
        <div className="flex justify-between gap-4">
          <h3 className="font-mono text-white">{name}</h3>
          <span className={status === 'ok' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-amber-300'}>
            {status}{stale ? ' · stale or not checked' : ''}
          </span>
        </div>
        <p className="text-xs text-text-muted">Last probe: {Number.isFinite(date) ? new Date(date).toLocaleString() : 'Never'}</p>
        {check?.error_msg && <p className="text-sm text-red-400">{check.error_msg}</p>}
        {!resource && <p className="text-sm text-amber-300">Waiting for the first report from the prod collector.</p>}
        {docker && <>
          {!docker.expected_configured && <p className="text-sm text-amber-300">Expected container inventory is not configured; missing containers cannot be detected.</p>}
          {!!docker.missing_containers?.length && <p className="text-sm text-red-400">Missing: {docker.missing_containers.join(', ')}</p>}
          {!docker.containers.length && <p className="text-sm text-amber-300">No containers found.</p>}
          <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <thead className="text-text-muted"><tr>{['Container', 'Image', 'State', 'Health', 'Restarts', 'Exit code'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
            <tbody>{docker.containers.filter(c => c.monitored !== false).map(c => <tr key={c.container_id} className="border-t border-border-glass">
              <td className="p-2 text-white">{c.name}</td><td className="p-2">{c.image}</td>
              <td className="p-2">{c.state}</td><td className="p-2">{c.health === 'none' ? 'No HEALTHCHECK' : c.health}</td>
              <td className="p-2">{c.restart_count}</td><td className="p-2">{c.exit_code}</td>
            </tr>)}</tbody>
          </table></div>
        </>}
      </div>;
    })}
  </section>;
}
