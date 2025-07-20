import { useState } from 'react';

const APITester = () => {
  const [testResult, setTestResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [jwt, setJwt] = useState('');

  const testBackendConnection = async () => {
    setLoading(true);
    setTestResult('Testing...');
    try {
      const baseURL = typeof window !== 'undefined' && (
        window.location.hostname === 'srrfarms.netlify.app' ||
        window.location.hostname === 'srrfarms-final.netlify.app' ||
        window.location.hostname !== 'localhost'
      ) ? 'https://srrfarms-backend.onrender.com/api'
        : 'http://localhost:3001/api';

      let result = `Backend URL: ${baseURL}\n`;

      // Health check
      const healthResponse = await fetch(`${baseURL}/health`);
      const healthData = await healthResponse.text();
      result += `Health Check: ${healthResponse.status} - ${healthData}\n`;

      // Authenticated order creation test
      if (jwt) {
        const orderPayload = {
          products: [{ productId: 'test-product-id', quantity: 1 }],
          paymentMethod: 'COD',
          address: 'Test Address',
        };
        try {
          const orderResponse = await fetch(`${baseURL}/orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify(orderPayload),
          });
          const orderData = await orderResponse.text();
          result += `Order Creation: ${orderResponse.status} - ${orderData}\n`;
        } catch (err) {
          result += `Order Creation Error: ${err}\n`;
        }
      } else {
        result += 'Order Creation: Skipped (No JWT provided)\n';
      }

      setTestResult(result);
    } catch (error) {
      setTestResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 bg-white border border-gray-300 rounded-lg p-4 shadow-lg max-w-md z-50">
      <h3 className="font-bold mb-2">API Debug Tool</h3>
      <input
        type="text"
        placeholder="Paste JWT token here for order test"
        value={jwt}
        onChange={e => setJwt(e.target.value)}
        className="w-full mb-2 px-2 py-1 border rounded text-xs"
      />
      <button
        onClick={testBackendConnection}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Backend'}
      </button>
      {testResult && (
        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
          {testResult}
        </pre>
      )}
    </div>
  );
};

export default APITester;
