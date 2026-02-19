import { useState } from 'react';
import type { ProcessResult } from '../lib/process';

interface GatewayStatusProps {
  status: 'unknown' | 'running' | 'stopped';
  port: number | null;
  pid: number | null;
  startedAt: string | null;
  onStart: () => Promise<ProcessResult>;
  onStop: () => Promise<ProcessResult>;
}

function formatUptime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - start) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function GatewayStatus({ status, port, pid, startedAt, onStart, onStop }: GatewayStatusProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRunning = status === 'running';
  const isStopped = status === 'stopped';

  async function handleStart() {
    setLoading(true);
    setError(null);
    const result = await onStart();
    if (!result.success) {
      setError(result.error ?? 'Failed to start gateway');
    }
    setLoading(false);
  }

  async function handleStop() {
    setLoading(true);
    setError(null);
    const result = await onStop();
    if (!result.success) {
      setError(result.error ?? 'Failed to stop gateway');
    }
    setLoading(false);
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Gateway</h2>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              isRunning ? 'bg-green-400' : isStopped ? 'bg-red-400' : 'bg-yellow-400'
            }`}
          />
          <span className={`text-sm font-medium ${
            isRunning ? 'text-green-400' : isStopped ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {isRunning ? 'Running' : isStopped ? 'Stopped' : 'Checking...'}
          </span>
        </div>
      </div>

      {isRunning && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Port</p>
            <p className="text-sm text-gray-200 font-mono">{port}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">PID</p>
            <p className="text-sm text-gray-200 font-mono">{pid}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Uptime</p>
            <p className="text-sm text-gray-200 font-mono">
              {startedAt ? formatUptime(startedAt) : '--'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 mb-3">{error}</p>
      )}

      <div className="flex gap-3">
        {isStopped && (
          <button
            onClick={handleStart}
            disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Starting...' : 'Start Gateway'}
          </button>
        )}
        {isRunning && (
          <button
            onClick={handleStop}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Stopping...' : 'Stop Gateway'}
          </button>
        )}
      </div>
    </div>
  );
}
