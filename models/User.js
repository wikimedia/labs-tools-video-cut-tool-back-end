const mongoose = require('mongoose')
const Schema = mongoose.Schema

const UserSchema = new Schema({
  id: String,
  username: String,
  mediawikiId: String,
  mediawikiToken: { type: String, select: false },
  mediawikiTokenSecret: { type: String, select: false },
  email: String,
  password: String,
  role: {
    type: String,
    default: 'normal',
  },
  firstName: String,
  lastName: String
})

UserSchema.pre('save', function (next) {
  const now = new Date()
  this.updated_at = now
  if (!this.created_at) {
    this.created_at = now
  }
  next()
})

UserSchema.statics.isObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id)

UserSchema.statics.getObjectId = (id) =>
  mongoose.Types.ObjectId(id)

const UserModel = mongoose.model('User', UserSchema);
module.exports = UserModel;