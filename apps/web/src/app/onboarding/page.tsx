'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type ProfileData = {
  display_name: string | null;
  org_name: string | null;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgNameLocked, setOrgNameLocked] = useState(false);
  const [industry, setIndustry] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((profile: ProfileData) => {
        if (profile.display_name) setDisplayName(profile.display_name);
        if (profile.org_name) {
          setOrgName(profile.org_name);
          setOrgNameLocked(true); // Pre-filled from invite — lock it
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, orgName, industry, employeeCount }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error === 'org_taken' ? 'org_taken' : (data.error ?? 'Failed to save profile'));
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-gray-200 p-8 w-full max-w-md shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Welcome to AILMS</h1>
        <p className="text-sm text-gray-500 mb-6">Tell us a bit about yourself and your company</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Your name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
              Company name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={orgNameLocked ? undefined : (e) => setOrgName(e.target.value)}
              readOnly={orgNameLocked}
              required
              placeholder="Acme Corp"
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                orgNameLocked ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
              }`}
            />
            {orgNameLocked && (
              <p className="text-xs text-gray-400 mt-1">Set by your team admin</p>
            )}
            {error === 'org_taken' && (
              <p className="text-sm text-red-600 mt-1">
                This company name is already registered. If your team already uses AILMS, ask your admin for an invite.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select industry...</option>
              <option value="saas">SaaS</option>
              <option value="ecommerce">E-commerce</option>
              <option value="healthcare">Healthcare</option>
              <option value="finance">Finance</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="retail">Retail</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="employeeCount" className="block text-sm font-medium text-gray-700 mb-1">
              Company size
            </label>
            <select
              id="employeeCount"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select size...</option>
              <option value="1-10">1–10 employees</option>
              <option value="11-50">11–50 employees</option>
              <option value="51-200">51–200 employees</option>
              <option value="201-1000">201–1000 employees</option>
              <option value="1000+">1000+ employees</option>
            </select>
          </div>

          {error && error !== 'org_taken' && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading ? 'Saving...' : 'Get started'}
          </button>
        </form>
      </div>
    </div>
  );
}
