import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: { rollupOptions: { input: {
    home: resolve('index.html'), login: resolve('login.html'), register: resolve('register.html'),
    poll: resolve('poll.html'), join: resolve('join.html'), create: resolve('create-poll.html'), session: resolve('create-session.html'), present: resolve('present.html'), audience: resolve('audience.html'), report: resolve('report.html'), profile: resolve('profile.html'), admin: resolve('admin.html')
  } } }
});
