export interface UserInfo {
  loggedIn: boolean;
  username?: string;
  email?: string;
  iss?: string;
  groups?: string[];
}
