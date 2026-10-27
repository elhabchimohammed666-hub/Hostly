import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false }
);

const capacitySchema = new mongoose.Schema(
  {
    adults: { type: Number, required: true, min: 1, max: 30 },
    children: { type: Number, default: 0, min: 0, max: 30 },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    type: {
      type: String,
      enum: ["standard", "deluxe", "suite", "other"],
      default: "standard",
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    pricePerNight: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      match: /^[A-Z]{3}$/,
      default: "EUR",
    },
    capacity: {
      type: capacitySchema,
      required: true,
    },
    amenities: {
      type: [String],
      default: [],
    },
    images: {
      type: [imageSchema],
      default: [],
    },
    totalUnits: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

roomSchema.index({ hotel: 1, type: 1, isActive: 1, pricePerNight: 1 });
roomSchema.index({ type: 1, isActive: 1 });

const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);

export default Room;
