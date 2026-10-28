/*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
import {
  getAvailableRooms,
  getRoomById
} from "../services/pmsApi.js";

function isValidDate(value) {
  if (typeof value !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validateSearch(checkIn, checkOut, guests) {
  if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
    return "Please enter valid check-in and check-out dates.";
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  if (checkIn < today) {
    return "Check-in cannot be in the past.";
  }

  if (checkOut <= checkIn) {
    return "Check-out must be later than check-in.";
  }

  if (!Number.isInteger(guests) || guests < 1 || guests > 10) {
    return "Guests must be a whole number between 1 and 10.";
  }

  return null;
}

export const bookingController = {

  home: (req, res) => {
    res.render("home");
  },

  roomsPage: (req, res) => {
    res.render("rooms");
  },

  guestDetailsPage: (req, res) => {
    res.render("guest-details");
  },

  confirmationPage: (req, res) => {
    if (!req.session.bookingPreview) {
      return res.redirect("/");
    }

    res.render("confirmation");
  },

  searchRooms: async (req, res) => {
    try {
      const { checkIn, checkOut } = req.query;
      const guests = Number(req.query.guests);

      const error = validateSearch(checkIn, checkOut, guests);

      if (error) {
        return res.status(400).json({
          success: false,
          message: error
        });
      }

      const rooms = await getAvailableRooms(
        checkIn,
        checkOut,
        guests
      );

      res.json({
        success: true,
        rooms
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Unable to search rooms."
      });
    }
  },

  createBookingPreview: async (req, res) => {
    try {
      const {
        roomId,
        checkIn,
        checkOut,
        guests,
        firstName,
        lastName,
        email,
        phone
      } = req.body;

      const guestCount = Number(guests);

      const error = validateSearch(
        checkIn,
        checkOut,
        guestCount
      );

      if (error) {
        return res.status(400).json({
          success: false,
          message: error
        });
      }

      if (
        typeof firstName !== "string" ||
        typeof lastName !== "string" ||
        typeof email !== "string" ||
        typeof phone !== "string" ||
        !firstName.trim() ||
        !lastName.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !/^[0-9+()\s-]{7,20}$/.test(phone)
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide valid guest information."
        });
      }

      const room = await getRoomById(roomId);

      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found."
        });
      }

      if (guestCount > room.capacity) {
        return res.status(400).json({
          success: false,
          message: "Room capacity exceeded."
        });
      }

      const milliseconds =
        new Date(checkOut).getTime() -
        new Date(checkIn).getTime();

      const nights = milliseconds / 86400000;

      const totalAmount = nights * room.price;

      const bookingPreview = {
        roomId: room.id,
        roomName: room.name,
        checkIn,
        checkOut,
        guests: guestCount,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        nights,
        pricePerNight: room.price,
        totalAmount,
        status: "PREVIEW ONLY"
      };

      req.session.bookingPreview = bookingPreview;

      res.json({
        success: true,
        message: "Booking preview created.",
        redirect: "/confirmation"
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Unable to prepare booking preview."
      });
    }
  },

  getBookingPreview: (req, res) => {
    const booking = req.session.bookingPreview;

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "No booking preview found."
      });
    }

    res.json({
      success: true,
      booking
    });
  }

};