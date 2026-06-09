import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Truck,
  Search,
  Power,
  PowerOff,
  Link2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { collaborationService, organizationService } from '../../services';
import { useToast } from '../../hooks/useToast';

const pairKey = (fleetId, hospitalId) => `${fleetId}__${hospitalId}`;

const readList = (res) => res?.data?.data?.organizations || res?.data?.organizations || res?.data?.data || res?.data || [];

/**
 * Hierarchical partnership manager. Roots are fleets (switchable to hospitals);
 * each root expands to every counterpart org with a toggle that activates
 * (creating if needed) or deactivates the partnership. Per-root "All on / All
 * off" controls apply the change to every child at once.
 */
export default function PartnershipMatrixTree() {
  const { toast } = useToast();

  const [orientation, setOrientation] = useState('fleet'); // 'fleet' | 'hospital'
  const [fleets, setFleets] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [statusMap, setStatusMap] = useState({}); // pairKey -> 'active' | 'inactive'
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [savingPairs, setSavingPairs] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { root, active, pairs }

  const loadPartnerships = useCallback(async () => {
    const res = await collaborationService.getMyPartnerships();
    const list = res?.data?.data?.partnerships || res?.data?.partnerships || [];
    const map = {};
    for (const p of list) {
      const fleetId = p.fleet_id?._id || p.fleet_id?.id || p.fleet_id;
      const hospitalId = p.hospital_id?._id || p.hospital_id?.id || p.hospital_id;
      if (fleetId && hospitalId) map[pairKey(String(fleetId), String(hospitalId))] = p.status || 'active';
    }
    setStatusMap(map);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [fleetRes, hospRes] = await Promise.all([
          organizationService.getAll({ type: 'fleet_owner', limit: 1000 }),
          organizationService.getAll({ type: 'hospital', limit: 1000 }),
        ]);
        if (cancelled) return;
        setFleets(readList(fleetRes).map((o) => ({ id: o.id || o._id, name: o.name, code: o.code, city: o.city })));
        setHospitals(readList(hospRes).map((o) => ({ id: o.id || o._id, name: o.name, code: o.code, city: o.city })));
        await loadPartnerships();
      } catch (err) {
        console.error('Failed to load partnership matrix', err);
        toast.error('Failed to load partnership data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadPartnerships, toast]);

  const roots = orientation === 'fleet' ? fleets : hospitals;
  const children = orientation === 'fleet' ? hospitals : fleets;

  // Returns { fleetId, hospitalId } for a (root, child) combination.
  const pairFor = useCallback((root, child) => (
    orientation === 'fleet'
      ? { fleetId: root.id, hospitalId: child.id }
      : { fleetId: child.id, hospitalId: root.id }
  ), [orientation]);

  const statusFor = useCallback((root, child) => {
    const { fleetId, hospitalId } = pairFor(root, child);
    return statusMap[pairKey(String(fleetId), String(hospitalId))];
  }, [pairFor, statusMap]);

  const q = search.trim().toLowerCase();
  const matches = (org) => !q || `${org.name || ''} ${org.code || ''} ${org.city || ''}`.toLowerCase().includes(q);

  const visibleRoots = useMemo(() => {
    if (!q) return roots;
    return roots.filter((r) => matches(r) || children.some(matches));
  }, [roots, children, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const childrenFor = useCallback((root) => {
    if (!q || matches(root)) return children;
    return children.filter(matches);
  }, [children, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCountFor = useCallback((root) => (
    children.reduce((n, child) => (statusFor(root, child) === 'active' ? n + 1 : n), 0)
  ), [children, statusFor]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePair = async (root, child, nextActive) => {
    const { fleetId, hospitalId } = pairFor(root, child);
    const key = pairKey(String(fleetId), String(hospitalId));
    const prev = statusMap[key];
    setSavingPairs((s) => new Set(s).add(key));
    setStatusMap((m) => ({ ...m, [key]: nextActive ? 'active' : 'inactive' }));
    try {
      await collaborationService.setPartnership({ fleetId, hospitalId, active: nextActive });
    } catch (err) {
      console.error('togglePair failed', err);
      setStatusMap((m) => ({ ...m, [key]: prev })); // revert
      toast.error(err.response?.data?.message || 'Failed to update partnership');
    } finally {
      setSavingPairs((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  };

  const requestBulk = (root, active) => {
    const list = childrenFor(root);
    // Only act on pairs that actually change.
    const pairs = list
      .filter((child) => {
        const st = statusFor(root, child);
        return active ? st !== 'active' : st === 'active';
      })
      .map((child) => pairFor(root, child));
    if (pairs.length === 0) {
      toast.info(active ? 'All already active' : 'Nothing active to turn off');
      return;
    }
    setConfirm({ root, active, pairs });
  };

  const runBulk = async () => {
    if (!confirm) return;
    setBulkBusy(true);
    try {
      const res = await collaborationService.bulkSetPartnerships({ pairs: confirm.pairs, active: confirm.active });
      const updated = res?.data?.data?.updated ?? confirm.pairs.length;
      toast.success(`${confirm.active ? 'Activated' : 'Deactivated'} ${updated} partnership${updated !== 1 ? 's' : ''}`);
      await loadPartnerships();
      setConfirm(null);
    } catch (err) {
      console.error('bulk failed', err);
      toast.error(err.response?.data?.message || 'Bulk update failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const RootIcon = orientation === 'fleet' ? Truck : Building2;
  const ChildIcon = orientation === 'fleet' ? Building2 : Truck;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Orientation switch */}
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-slate-700 p-1">
            {[
              { id: 'fleet', label: 'Fleet → Hospitals', icon: Truck },
              { id: 'hospital', label: 'Hospital → Fleets', icon: Building2 },
            ].map((o) => {
              const Icon = o.icon;
              return (
                <button
                  key={o.id}
                  onClick={() => { setOrientation(o.id); setExpanded(new Set()); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    orientation === o.id ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {o.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Active</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> Inactive</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 border border-gray-300" /> Not linked</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 bg-transparent rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-44"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tree */}
      {loading ? (
        <Card className="p-10 text-center text-gray-500">
          <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin text-primary" />
          Loading partnerships…
        </Card>
      ) : visibleRoots.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">No {orientation === 'fleet' ? 'fleets' : 'hospitals'} found.</Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {visibleRoots.map((root) => {
            const isOpen = expanded.has(root.id) || !!q;
            const kids = childrenFor(root);
            const activeCount = activeCountFor(root);
            return (
              <div key={root.id}>
                {/* Root row */}
                <div className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <button onClick={() => toggleExpand(root.id)} className="p-1 text-gray-400 hover:text-gray-600">
                    {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white flex-shrink-0">
                    <RootIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text truncate">{root.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {root.code}{root.city ? ` • ${root.city}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    activeCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {activeCount} / {children.length} active
                  </span>
                  <div className="hidden sm:flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => requestBulk(root, true)}>
                      <Power className="w-4 h-4 mr-1.5 text-green-600" /> All on
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => requestBulk(root, false)}>
                      <PowerOff className="w-4 h-4 mr-1.5 text-gray-500" /> All off
                    </Button>
                  </div>
                </div>

                {/* Children */}
                {isOpen && (
                  <div className="bg-gray-50/60 dark:bg-slate-900/40 pl-6 sm:pl-16 pr-4 pb-2">
                    {/* mobile bulk buttons */}
                    <div className="flex sm:hidden items-center gap-2 py-2">
                      <Button variant="outline" size="sm" onClick={() => requestBulk(root, true)}>
                        <Power className="w-4 h-4 mr-1.5 text-green-600" /> All on
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => requestBulk(root, false)}>
                        <PowerOff className="w-4 h-4 mr-1.5 text-gray-500" /> All off
                      </Button>
                    </div>
                    {kids.length === 0 ? (
                      <p className="text-sm text-gray-400 py-3">No matches.</p>
                    ) : kids.map((child) => {
                      const status = statusFor(root, child);
                      const { fleetId, hospitalId } = pairFor(root, child);
                      const key = pairKey(String(fleetId), String(hospitalId));
                      const saving = savingPairs.has(key);
                      const isActive = status === 'active';
                      return (
                        <div key={child.id} className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
                          <ChildIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text truncate">{child.name}</p>
                            <p className="text-xs text-gray-400 truncate">{child.code}{child.city ? ` • ${child.city}` : ''}</p>
                          </div>
                          <span className={`text-xs font-medium ${
                            isActive ? 'text-green-600' : status === 'inactive' ? 'text-gray-500' : 'text-gray-300'
                          }`}>
                            {isActive ? 'Active' : status === 'inactive' ? 'Inactive' : 'Not linked'}
                          </span>
                          {/* Toggle */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isActive}
                            disabled={saving}
                            onClick={() => togglePair(root, child, !isActive)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                              isActive ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-600'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Bulk confirm */}
      <Modal
        isOpen={!!confirm}
        onClose={() => !bulkBusy && setConfirm(null)}
        title={confirm?.active ? 'Activate all partnerships' : 'Deactivate all partnerships'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={bulkBusy}>Cancel</Button>
            <Button variant={confirm?.active ? 'primary' : 'danger'} onClick={runBulk} loading={bulkBusy}>
              {confirm?.active ? 'Activate' : 'Deactivate'} {confirm?.pairs.length}
            </Button>
          </>
        }
      >
        {confirm && (
          <div className="space-y-3">
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              confirm.active ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
            }`}>
              {confirm.active
                ? <Link2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                : <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />}
              <div className="text-sm">
                <p className="font-semibold mb-1">
                  {confirm.active ? 'Activate' : 'Deactivate'} {confirm.pairs.length} partnership{confirm.pairs.length !== 1 ? 's' : ''} for {confirm.root.name}?
                </p>
                <p className="text-gray-600">
                  {confirm.active
                    ? 'This links the org with every listed counterpart.'
                    : 'This releases any ambulances and unassigns staff between them (sessions in progress are kept).'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
