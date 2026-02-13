# Use Node.js to build the app
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Run Vite in preview mode on the specific port
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "7860"]