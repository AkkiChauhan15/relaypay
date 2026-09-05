import { app } from './app.js';

const parsedPort = Number.parseInt(process.env.PORT ?? '3000', 10);
const port = Number.isNaN(parsedPort) ? 3000 : parsedPort;

app.listen(port, () => {
  console.info(`RelayPay backend listening on port ${port}`);
});
