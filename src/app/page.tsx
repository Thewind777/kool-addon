import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Group Order MVP</h1>
          <p className="text-gray-600">Shared ordering & QR wallet transfers</p>
        </div>

        <div className="space-y-4">
          <Link
            href="/order/create"
            className="block card p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5 5 5-5" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Create Group Order</h3>
                <p className="text-sm text-gray-500">Generate a share link for collaborative ordering</p>
              </div>
            </div>
          </Link>

          <Link
            href="/wallet"
            className="block card p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Wallet & QR Transfer</h3>
                <p className="text-sm text-gray-500">Generate QR codes for peer-to-peer payments</p>
              </div>
            </div>
          </Link>

          <Link
            href="/order/DEMO123456"
            className="block card p-6 hover:shadow-md transition-shadow border-primary-200"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Demo Group Order</h3>
                <p className="text-sm text-gray-500">Try the shared order with code: DEMO123456</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="text-center text-sm text-gray-500 pt-4 border-t">
          <p>Demo users: Feras, Ahmed, Sarah</p>
        </div>
      </div>
    </main>
  );
}