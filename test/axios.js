import axios from "axios";

const Axios = axios.create({
	timeout: 15000,
});

Axios.isCancel = axios.isCancel;
Axios.CancelToken = axios.CancelToken;

export default Axios;
