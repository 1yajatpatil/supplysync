import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const ENGINE_URL = process.env.OPTIMIZATION_SERVICE_URL || 'http://localhost:8000';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper to fetch from Python Optimization Service with timeout
async function fetchEngine(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${ENGINE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Engine returned ${response.status}: ${errBody}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/csv')) {
      return await response.text();
    }
    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Optimization Engine request to '${path}' timed out.`);
    }
    throw err;
  }
}

// Health Check
app.get('/api/health', async (req: Request, res: Response) => {
  let engineStatus = 'unreachable';
  try {
    const data = await fetchEngine('/health');
    engineStatus = data.status || 'healthy';
  } catch {
    engineStatus = 'offline';
  }

  res.json({
    status: 'healthy',
    gateway: 'Node.js Express Gateway',
    engineStatus,
    timestamp: new Date().toISOString()
  });
});

// Dataset Diagnostics API
app.get('/api/dataset-status', async (req: Request, res: Response) => {
  try {
    const data = await fetchEngine('/api/dataset-status');
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to retrieve dataset status', details: err.message });
  }
});

// FMCG Master Data APIs
app.get('/api/master-data', async (req: Request, res: Response) => {
  try {
    const dataSource = req.query.data_source || 'synthetic';
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=${dataSource}&horizon=${horizon}`);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to retrieve master data from optimization engine', details: err.message });
  }
});

app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const dataSource = req.query.data_source || 'synthetic';
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=${dataSource}&horizon=${horizon}`);
    res.json(data.products || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/warehouses', async (req: Request, res: Response) => {
  try {
    const dataSource = req.query.data_source || 'synthetic';
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=${dataSource}&horizon=${horizon}`);
    res.json(data.warehouses || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/destinations', async (req: Request, res: Response) => {
  try {
    const dataSource = req.query.data_source || 'synthetic';
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=${dataSource}&horizon=${horizon}`);
    res.json(data.destinations || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/inventory', async (req: Request, res: Response) => {
  try {
    const dataSource = req.query.data_source || 'synthetic';
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=${dataSource}&horizon=${horizon}`);
    res.json(data.batches || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/demand', async (req: Request, res: Response) => {
  try {
    const dataSource = req.query.data_source || 'synthetic';
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=${dataSource}&horizon=${horizon}`);
    res.json(data.demand || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/routes', async (req: Request, res: Response) => {
  try {
    const dataSource = req.query.data_source || 'synthetic';
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=${dataSource}&horizon=${horizon}`);
    res.json(data.routes || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// Demand Forecasting API
app.post('/api/forecast/predict', async (req: Request, res: Response) => {
  try {
    const result = await fetchEngine('/api/forecast', {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: 'Demand forecasting failed', details: err.message });
  }
});

// Baseline Distribution API
app.post('/api/optimization/baseline', async (req: Request, res: Response) => {
  try {
    const plan = await fetchEngine('/api/baseline', {
      method: 'POST',
      body: JSON.stringify(req.body || {})
    });
    res.json(plan);
  } catch (err: any) {
    res.status(502).json({ error: 'Baseline distribution failed', details: err.message });
  }
});

// Constrained Optimization API
app.post('/api/optimization/run', async (req: Request, res: Response) => {
  try {
    const plan = await fetchEngine('/api/optimize', {
      method: 'POST',
      body: JSON.stringify(req.body || {})
    });
    res.json(plan);
  } catch (err: any) {
    res.status(502).json({ error: 'Optimization engine run failed', details: err.message });
  }
});

// Baseline vs. Optimized Comparison API
app.post('/api/optimization/compare', async (req: Request, res: Response) => {
  try {
    const audit = await fetchEngine('/api/compare', {
      method: 'POST',
      body: JSON.stringify(req.body || {})
    });
    res.json(audit);
  } catch (err: any) {
    res.status(502).json({ error: 'Optimization comparison failed', details: err.message });
  }
});

// Plan CSV Export API
app.get('/api/optimization/runs/:id/export', async (req: Request, res: Response) => {
  try {
    const csvContent = await fetchEngine(`/api/export/${req.params.id}`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=supplysync_distribution_${req.params.id}.csv`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to export distribution plan', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SupplySync API Gateway listening on http://localhost:${PORT}`);
  console.log(`Optimization Engine Target: ${ENGINE_URL}`);
});
