import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface UPIPaymentProps {
  orderTotal: number;
  onSuccess: (order: any) => void;
  onCancel: () => void;
  shippingAddress: any;
}

interface UPIInfo {
  upiId: string;
  merchantName: string;
  qrCodeUrl: string;
  instructions: string[];
}

const UPIPayment: React.FC<UPIPaymentProps> = ({ 
  orderTotal, 
  onSuccess, 
  onCancel, 
  shippingAddress 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [upiInfo, setUpiInfo] = useState<UPIInfo | null>(null);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetchUPIInfo();
  }, []);

  const fetchUPIInfo = async () => {
    try {
      const response = await fetch('/api/payments/upi-info', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setUpiInfo(data.upiInfo);
      }
    } catch (error) {
      console.error('Error fetching UPI info:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      setPaymentScreenshot(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleRemoveFile = () => {
    setPaymentScreenshot(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitPayment = async () => {
    if (!paymentScreenshot) {
      alert('Please upload payment screenshot');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('paymentScreenshot', paymentScreenshot);
      formData.append('shippingAddress', JSON.stringify(shippingAddress));
      formData.append('upiTransactionId', upiTransactionId);
      formData.append('notes', notes);

      const response = await fetch('/api/payments/create-upi-order', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(data.order);
      } else {
        throw new Error(data.message || 'Payment failed');
      }
    } catch (error: any) {
      console.error('UPI payment error:', error);
      alert(error.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateUPILink = () => {
    if (!upiInfo) return '';
    const amount = orderTotal;
    const note = `Order payment - SRR Farms`;
    return `upi://pay?pa=${upiInfo.upiId}&pn=${upiInfo.merchantName}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  };

  if (!upiInfo) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">UPI Payment</h3>
        <p className="text-2xl font-bold text-green-600">₹{orderTotal}</p>
      </div>

      {!showUploadForm ? (
        <div className="space-y-6">
          {/* QR Code Section */}
          <div className="text-center">
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <img 
                src={upiInfo.qrCodeUrl} 
                alt="UPI QR Code" 
                className="w-48 h-48 mx-auto mb-4 border-2 border-gray-200 rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <p className="text-sm text-gray-600">Scan QR code with any UPI app</p>
            </div>
          </div>

          {/* UPI ID Section */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              UPI ID:
            </label>
            <div className="flex items-center justify-between bg-white p-3 rounded border">
              <span className="font-mono text-blue-600">{upiInfo.upiId}</span>
              <button
                onClick={() => navigator.clipboard.writeText(upiInfo.upiId)}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                📋 Copy
              </button>
            </div>
          </div>

          {/* Payment Link Button */}
          <div className="text-center">
            <a
              href={generateUPILink()}
              className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              📱 Pay with UPI App
            </a>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">Payment Instructions:</h4>
            <ol className="text-sm text-gray-600 space-y-1">
              {upiInfo.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-yellow-600 mr-2">{index + 1}.</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={() => setShowUploadForm(true)}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              ✅ I've Made Payment
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-center">
            <h4 className="text-lg font-medium text-gray-800 mb-2">Upload Payment Proof</h4>
            <p className="text-sm text-gray-600">Upload screenshot of successful payment</p>
          </div>

          {/* Transaction ID Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              UPI Transaction ID (Optional)
            </label>
            <input
              type="text"
              value={upiTransactionId}
              onChange={(e) => setUpiTransactionId(e.target.value)}
              placeholder="Enter UPI transaction ID"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Screenshot *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {!paymentScreenshot ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    📷 Choose Screenshot
                  </button>
                  <p className="text-sm text-gray-500 mt-2">Max size: 5MB</p>
                </div>
              ) : (
                <div>
                  <img
                    src={previewUrl!}
                    alt="Payment screenshot preview"
                    className="max-w-full max-h-48 mx-auto rounded-lg mb-3"
                  />
                  <p className="text-sm text-gray-600 mb-2">{paymentScreenshot.name}</p>
                  <button
                    onClick={handleRemoveFile}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    🗑️ Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information..."
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleSubmitPayment}
              disabled={loading || !paymentScreenshot}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </span>
              ) : (
                '✅ Submit Order'
              )}
            </button>
            <button
              onClick={() => setShowUploadForm(false)}
              disabled={loading}
              className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-400 disabled:bg-gray-200 transition-colors"
            >
              ← Back
            </button>
          </div>

          {/* Verification Note */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Your order will be confirmed after admin verification of the payment screenshot. 
              You will receive a confirmation once verified.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UPIPayment;
