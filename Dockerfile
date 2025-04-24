# Use the official Node.js 22 image as the base image
FROM node:22-bookworm-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./
COPY tsconfig.json ./

# Copy the rest of the application source code to the working directory
COPY ./src ./src

# Install project dependencies
RUN npm ci && \
    npm run build && \
    npm ci --omit=dev && \
    rm -rf src

# Install rclone and borgbackup
RUN apt update && \
    apt install -y borgbackup curl busybox && \
    curl https://rclone.org/install.sh | bash && \
    apt remove -y busybox

# Start the application
CMD ["node", "dist/main.js"]