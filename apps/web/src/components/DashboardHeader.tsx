'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserMenu } from './UserMenu';
import { ChatDrawer } from './ChatDrawer';

type Props = {
  displayName: string;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

export function DashboardHeader({ displayName, isAdmin, signOut }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AILMS</h1>
            <p className="text-sm text-gray-500">AI Sales Enablement</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Test
            </button>
            <Link
              href="/products/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + New Agent
            </Link>
            <UserMenu
              displayName={displayName}
              isAdmin={isAdmin}
              signOut={signOut}
            />
          </div>
        </div>
      </header>

      <ChatDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
