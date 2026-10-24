import {validate} from './model.js';
export class SessionClient {
  async request(path,method='GET',body) {
    const response=await fetch('/admin-api/'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'X-Admin-Request':'1',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    let result;try{result=await response.json();}catch{throw new Error('Password login is not available yet. The private backend needs to be connected.');}
    if(!response.ok)throw new Error(result.error||'The admin request failed.');
    return result;
  }
  login(username,password){return this.request('login','POST',{username,password});}
  async load(){const result=await this.request('content');validate(result.data);return result;}
  publish(data,sha){validate(data);return this.request('content','PUT',{data,sha});}
  clear(){return this.request('logout','POST',{});}
}
