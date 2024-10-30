import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT:number = parseInt(process.env.PORT || '3000', 10);
const HOST = '127.0.0.1';

app.listen(PORT,HOST, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
