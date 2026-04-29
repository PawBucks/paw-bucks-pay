export const APP_BASE_URL ="https://pawbucks.app";

export const buildAppUrl = (path ="/") => {
 const normalizedPath = path.startsWith("/") ? path : `/${path}`;
 return `${APP_BASE_URL}${normalizedPath}`;
};