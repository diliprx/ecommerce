import axios from "axios";

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_APP_URL + "/api/v1",
  withCredentials: true, // crucial to send HTTP-only cookies
});

export default instance;