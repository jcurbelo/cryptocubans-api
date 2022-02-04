import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {User} from "./user.interface";

admin.initializeApp();

export const auth = functions.https.onRequest(async (req, res) => {
  functions.logger.info("Auth trigger", {structuredData: true});
  const db = admin.firestore();
  const {address} = req.query;

  const data = await db.collection("users")
      .where("address", "==", address)
      .get();

  const user: User = {address: address as string};

  if (data.empty) {
    user.id = (await db.collection("users").add(user)).id;
  } else {
    user.id = data.docs[0].id;
  }
  user.nonce = Math.floor(Math.random() * 10000000);
  await db.collection("users")
      .doc(user.id as string)
      .update({nonce: user.nonce});

  res.status(200).json(user);
});
