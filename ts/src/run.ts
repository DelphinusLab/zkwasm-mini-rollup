import { Service } from "./service.js";

const service = new Service(()=>{return;});
service.initialize();
service.serve();

