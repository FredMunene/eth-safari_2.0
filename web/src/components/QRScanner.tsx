import { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Camera, X, CheckCircle, AlertCircle } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { recordCheckInRequest } from '../lib/opsProxy';

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

type ScanResult = {
  success: boolean;
  message: string;
  participant?: {
    name: string;
    role: string;
  };
};

export default function QRScanner({ onClose, onSuccess }: Props) {
  const [hasCamera, setHasCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualToken, setManualToken] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const { getAccessToken } = usePrivy();

  useEffect(() => {
    checkCamera();
    return () => {
      stopScanning();
    };
  }, []);

  async function checkCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasCamera(videoDevices.length > 0);
    } catch (error) {
      console.error('Error checking camera:', error);
      setHasCamera(false);
    }
  }

  async function startScanning() {
    if (!videoRef.current) return;

    try {
      setScanning(true);
      readerRef.current = new BrowserMultiFormatReader();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      readerRef.current.decodeFromVideoDevice(
        null,
        videoRef.current,
        async (result) => {
          if (result) {
            await processQRCode(result.getText());
          }
        }
      );
    } catch (error) {
      console.error('Error starting scanner:', error);
      alert('Failed to access camera. Please check permissions.');
      setScanning(false);
    }
  }

  function stopScanning() {
    if (readerRef.current) {
      readerRef.current.reset();
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setScanning(false);
  }

  async function processQRCode(qrData: string) {
    try {
      const payload = JSON.parse(qrData);

      if (payload.type !== 'travel_approval') {
        setResult({
          success: false,
          message: 'Invalid QR code type',
        });
        return;
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Unable to fetch Privy access token. Please re-authenticate.');
      }

      const data = await recordCheckInRequest(accessToken, {
        token: payload.token,
        location: 'ETH Safari Venue',
      });

      setResult({
        success: true,
        message: 'Check-in successful!',
        participant: {
          name: data.participant?.name ?? 'Participant',
          role: data.participant?.role ?? 'Attendee',
        },
      });

      stopScanning();
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (error) {
      console.error('Error processing QR code:', error);
      setResult({
        success: false,
        message: (error as { message?: string })?.message ?? 'Failed to process QR code',
      });
    }
  }

  async function handleManualEntry(e: React.FormEvent) {
    e.preventDefault();
    const mockPayload = {
      type: 'travel_approval',
      token: manualToken,
      timestamp: new Date().toISOString(),
    };
    await processQRCode(JSON.stringify(mockPayload));
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">QR Check-In Scanner</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {result ? (
            <div className={`p-6 rounded-lg border-2 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                {result.success ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-red-600" />
                )}
                <div>
                  <h3 className={`text-lg font-semibold ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                    {result.message}
                  </h3>
                  {result.participant && (
                    <div className="mt-2 text-sm text-slate-700">
                      <p className="font-medium">{result.participant.name}</p>
                      <p className="text-slate-600">{result.participant.role}</p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setResult(null);
                  setManualToken('');
                }}
                className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Scan Another
              </button>
            </div>
          ) : (
            <>
              {hasCamera && !scanning && (
                <button
                  onClick={startScanning}
                  className="w-full mb-4 flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Camera className="h-5 w-5" />
                  Start Camera Scanner
                </button>
              )}

              {scanning && (
                <div className="mb-4">
                  <video
                    ref={videoRef}
                    className="w-full rounded-lg border-2 border-blue-500"
                    style={{ maxHeight: '400px' }}
                  />
                  <button
                    onClick={stopScanning}
                    className="w-full mt-3 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Stop Scanning
                  </button>
                </div>
              )}

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">Or enter manually</span>
                </div>
              </div>

              <form onSubmit={handleManualEntry} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    QR Token
                  </label>
                  <input
                    type="text"
                    required
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Paste token or approval ID..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Process Check-In
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
