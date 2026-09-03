'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { formatCents } from '@/lib/utils';

const USERS = [
  { id: 'feras-uuid', name: 'Feras' },
  { id: 'ahmed-uuid', name: 'Ahmed' },
  { id: 'sarah-uuid', name: 'Sarah' },
];

interface WalletTransaction {
  id: string;
  senderId: string;
  receiverId: string;
  amountCents: number;
  type: string;
  referenceId: string | null;
  createdAt: string;
  sender: { id: string; name: string };
  receiver: { id: string; name: string };
}

interface QRGenerateResponse {
  success: boolean;
  data?: {
    token: string;
    qrCodeDataUrl: string;
    expiresIn: number;
    user: { id: string; name: string };
    requestedAmountCents: number | null;
  };
  message?: string;
}

interface QRTransferResponse {
  success: boolean;
  message: string;
  senderBalance?: number;
  receiverBalance?: number;
}

export default function WalletPage() {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  // QR Generation
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrExpiry, setQrExpiry] = useState(0);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrAmount, setQrAmount] = useState('');
  const [qrExpirySeconds, setQrExpirySeconds] = useState(60);

  // QR Scanner
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<{ success: boolean; message: string } | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Fetch user balance and transactions
  const fetchUserData = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const [balanceRes, txRes] = await Promise.all([
        fetch(`/api/wallet/balance?userId=${selectedUser}`),
        fetch(`/api/wallet/transactions?userId=${selectedUser}&limit=20`),
      ]);
      
      const balanceData = await balanceRes.json();
      const txData = await txRes.json();

      if (balanceData.success) setBalance(balanceData.data.balance);
      if (txData.success) setTransactions(txData.data);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [selectedUser]);

  // Generate QR Code
  const handleGenerateQR = async () => {
    if (!selectedUser) return;
    const user = USERS.find(u => u.id === selectedUser);
    if (!user) return;

    setQrGenerating(true);
    try {
      const response = await fetch('/api/wallet/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser,
          userName: user.name,
          requestedAmountCents: qrAmount ? Math.round(parseFloat(qrAmount) * 100) : undefined,
          expirySeconds: qrExpirySeconds,
        }),
      });

      const data: QRGenerateResponse = await response.json();

      if (data.success && data.data) {
        setQrCodeDataUrl(data.data.qrCodeDataUrl);
        setQrToken(data.data.token);
        setQrExpiry(Date.now() + data.data.expiresIn * 1000);
      } else {
        alert(data.message || 'Failed to generate QR code');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setQrGenerating(false);
    }
  };

  // Start QR Scanner
  const startScanner = () => {
    if (!scannerContainerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      'qr-scanner',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      async (decodedText: string) => {
        // Stop scanner after successful scan
        setScanning(false);
        setScanResult(decodedText);
        await scanner.clear();
      },
      (error: string) => {
        // Ignore scan errors
      }
    );

    setScanning(true);
  };

  // Stop QR Scanner
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (err) {
        console.error('Error clearing scanner:', err);
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // Handle QR Scan Result - Transfer
  const handleTransferFromQR = async () => {
    if (!scanResult || !selectedUser) return;

    setTransferring(true);
    setTransferResult(null);

    try {
      const response = await fetch('/api/wallet/qr/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: selectedUser,
          token: scanResult,
        }),
      });

      const data: QRTransferResponse = await response.json();
      setTransferResult({ success: data.success, message: data.message });

      if (data.success) {
        setBalance(data.senderBalance || 0);
        fetchUserData();
        setScanResult(null);
      }
    } catch (err) {
      setTransferResult({ success: false, message: 'Network error' });
    } finally {
      setTransferring(false);
    }
  };

  // Format time remaining for QR expiry
  const getTimeRemaining = () => {
    if (!qrExpiry) return 0;
    return Math.max(0, Math.ceil((qrExpiry - Date.now()) / 1000));
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <h1 className="font-semibold text-gray-900">Wallet</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-4 space-y-6">
        {/* User Selector */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select User</label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="input"
          >
            <option value="">Select user...</option>
            {USERS.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>

        {selectedUser && (
          <>
            {/* Balance Card */}
            <div className="card p-6 bg-gradient-to-br from-primary-600 to-primary-700 text-white">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm opacity-80">Current Balance</span>
              </div>
              <div className="text-4xl font-bold">{formatCents(balance)}</div>
            </div>

            {/* QR Code Generator */}
            <div className="card p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h-.08M12 12.5V12m3.249 7.05l4.157-4.157a.4.4 0 00-.566-.565L12 17.883l-3.843-3.843a.4.4 0 00-.566 0L6.05 15.88a.4.4 0 000 .566l4.157 4.157M12 12.5V12" />
                </svg>
                <span>Generate QR Code</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Request Amount (optional)
                  </label>
                  <div className="flex space-x-2">
                    <span className="flex items-center px-3 bg-gray-100 rounded-l-lg text-gray-500">$</span>
                    <input
                      type="number"
                      value={qrAmount}
                      onChange={(e) => setQrAmount(e.target.value)}
                      placeholder="15.00"
                      className="input flex-1 rounded-l-none"
                      step="0.01"
                      min="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry: {qrExpirySeconds}s
                  </label>
                  <input
                    type="range"
                    min="30"
                    max="300"
                    step="30"
                    value={qrExpirySeconds}
                    onChange={(e) => setQrExpirySeconds(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>

                <button
                  onClick={handleGenerateQR}
                  disabled={qrGenerating}
                  className="btn-primary w-full"
                >
                  {qrGenerating ? 'Generating...' : 'Generate QR Code'}
                </button>
              </div>

              {qrCodeDataUrl && (
                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <img src={qrCodeDataUrl} alt="QR Code" className="mx-auto w-48 h-48" />
                    <p className="text-sm text-gray-500 mt-2">
                      Expires in {getTimeRemaining()}s
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Token: {qrToken?.slice(0, 20)}...</p>
                    {qrAmount && (
                      <p className="text-primary-600 font-medium">
                        Requests: {formatCents(Math.round(parseFloat(qrAmount) * 100))}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* QR Code Scanner */}
            <div className="card p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Scan QR to Send Money</span>
              </h3>

              {!scanning ? (
                <button onClick={startScanner} className="btn-secondary w-full">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h-.08M12 12.5V12m3.249 7.05l4.157-4.157a.4.4 0 00-.566-.565L12 17.883l-3.843-3.843a.4.4 0 00-.566 0L6.05 15.88a.4.4 0 000 .566l4.157 4.157M12 12.5V12" />
                  </svg>
                  Open Camera to Scan
                </button>
              ) : (
                <div className="space-y-3">
                  <div ref={scannerContainerRef} id="qr-scanner" className="w-full aspect-square bg-gray-900 rounded-lg overflow-hidden" />
                  <button onClick={stopScanner} className="btn-danger w-full">
                    Stop Scanning
                  </button>
                </div>
              )}

              {scanResult && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm font-medium text-gray-900">QR Code Detected</p>
                  <p className="text-xs text-gray-500 font-mono break-all">{scanResult.slice(0, 50)}...</p>
                  <button
                    onClick={handleTransferFromQR}
                    disabled={transferring}
                    className="btn-primary w-full"
                  >
                    {transferring ? 'Transferring...' : 'Confirm & Send Money'}
                  </button>
                  {transferResult && (
                    <div className={`p-3 text-sm rounded-lg ${
                      transferResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {transferResult.message}
                    </div>
                  )}
                  <button
                    onClick={() => setScanResult(null)}
                    className="text-sm text-gray-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Transaction History */}
            <div className="card">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
              </div>
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No transactions yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {transactions.map((tx) => (
                    <li key={tx.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          tx.senderId === selectedUser ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {tx.senderId === selectedUser ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            )}
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {tx.senderId === selectedUser ? `Sent to ${tx.receiver.name}` : `Received from ${tx.sender.name}`}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{tx.type.replace('_', ' ').toLowerCase()}</p>
                        </div>
                      </div>
                      <span className={`font-semibold ${tx.senderId === selectedUser ? 'text-red-600' : 'text-green-600'}`}>
                        {tx.senderId === selectedUser ? '-' : '+'}{formatCents(tx.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}