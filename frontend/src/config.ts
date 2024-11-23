const config = {
  server: {
    host: process.env.REACT_APP_SERVER_HOST || "localhost",
    port: process.env.REACT_APP_SERVER_PORT || "8000",
    get baseUrl() {
      return `http://${this.host}:${this.port}`;
    },
    get wsUrl() {
      return `ws://${this.host}:${this.port}`;
    },
  },
};

export default config;
