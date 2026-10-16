import {
    getBackgroundScript,
    getBaseManifest,
    getBrowserActionInfo,
    getCommonPermissions,
    getHostPermissions
} from "./shared";
import ManifestV3 = chrome.runtime.ManifestV3;
// import ManifestV2 = chrome.runtime.ManifestV2;

export function getManifestForChrome(): ManifestV3 {
    return {
        // as far as I know manifest version 3 does not allow request blocking
        manifest_version: 3,
        // Stable identity for personal/unpacked installations. This is the
        // public key only; no signing private key is stored in the repository.
        key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs74FX/9gdWZxB6aylh5VPgRAHXBjUjBTy36PPzI/rY/dSiEDbo10N5xGh8tj6fGZ9eWOgEhSJFTLHYDs11ipIJ3C0T16IN9UxeqkynQkq3oKpwIrRkgGcpTPHbHyRDM7GBqWwU//fatmnW/cyLYQ05/taCowAYUJ/tJJY2x19xhJOcJLfJcZ4LPrkDjcu9aEgV6FBsIRKT2b7M5E5I1tyOQAGqVPnwsz5HGci3i6jDmnImmpDiZHNM0Yk+IgXr57G908Fkt3x3RmurSNX5BvFruxpH7pogepOrxKoDLPiYsUBZL4M0LAsj45IjF3l8E5bt67lEJLTvVaNKaJOeQp7wIDAQAB",
        ...getBaseManifest(),
        background: {
            service_worker: getBackgroundScript(),
        },
        action: getBrowserActionInfo(),
        host_permissions: getHostPermissions(),
        permissions: getCommonPermissions(),
    }
    /*return {
        manifest_version: 2,
        ...getBaseManifest(),
        background: {
            scripts: [getBackgroundScript()],
        },
        browser_action: getBrowserActionInfo(),
        permissions: [
            ...getHostPermissions(),
            ...getCommonPermissions(),
        ],
    }*/
}
