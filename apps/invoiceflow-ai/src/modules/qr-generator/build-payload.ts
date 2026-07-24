import {
  buildAppPayload,
  buildBusinessPayload,
  buildFacebookPayload,
  buildSocialPayload,
  buildTextPayload,
  buildUrlPayload,
  buildVCardPayload,
  buildWifiPayload,
  type QrContentType,
} from "@daromsart/qr";
import type { QrFormValues } from "./types";

/** Construit le payload scannable selon le type et les champs du formulaire. */
export function buildPayloadFromForm(
  type: QrContentType,
  values: QrFormValues,
): string | null {
  switch (type) {
    case "url":
    case "pdf":
    case "images":
    case "video":
    case "menu":
      return buildUrlPayload(values.url);
    case "text":
      return buildTextPayload(values.text);
    case "wifi":
      return buildWifiPayload({
        ssid: values.wifiSsid,
        password: values.wifiPassword,
        encryption: values.wifiEncryption,
        hidden: values.wifiHidden,
      });
    case "vcard":
      return buildVCardPayload({
        firstName: values.vcardFirstName,
        lastName: values.vcardLastName,
        organization: values.vcardOrganization,
        phone: values.vcardPhone,
        email: values.vcardEmail,
        url: values.vcardUrl,
      });
    case "social":
      return buildSocialPayload(values.socialPlatform, values.socialHandle);
    case "facebook":
      return buildFacebookPayload(values.facebook);
    case "app":
      return buildAppPayload({
        iosUrl: values.appIosUrl,
        androidUrl: values.appAndroidUrl,
      });
    case "business":
      return buildBusinessPayload({
        name: values.businessName,
        phone: values.businessPhone,
        email: values.businessEmail,
        website: values.businessWebsite,
        address: values.businessAddress,
      });
    default:
      return null;
  }
}
