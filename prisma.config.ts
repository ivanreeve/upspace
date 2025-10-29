import path from 'node:path';

import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config();

export default defineConfig({ schema: path.join('prisma', 'schema.prisma'), });
