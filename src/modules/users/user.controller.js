const service = require("./user.service");

// Add comments by farah

// ================= CREATE USER =================
exports.create = async (req, res, next) => {
  try {
    await service.createUser(req.body);
    res.status(201).json({ message: "User created" });
  } catch (e) {
    next(e);
  }
};

// ================= UPDATE USER =================
exports.update = async (req, res, next) => {
  try {
    await service.updateUser(req.params.id, req.body);
    res.json({ message: "User updated" });
  } catch (e) {
    next(e);
  }
};

// ================= DEACTIVATE USER =================
exports.deactivate = async (req, res, next) => {
  try {
    await service.deactivateUser(req.params.id);
    res.json({ message: "User deactivated" });
  } catch (e) {
    next(e);
  }
};

// ================= REACTIVATE USER =================
exports.reactivate = async (req, res, next) => {
  try {
    await service.reactivateUser(req.params.id);
    res.json({ message: "User reactivated" });
  } catch (e) {
    next(e);
  }
};

// ================ TRANSFER PATIENTS TO ANOTHER DOCTOR =================
exports.transfer = async (req, res, next) => {
  try {
    const { oldDoctor, newDoctor } = req.body;
    await service.transferPatients(oldDoctor, newDoctor);
    res.json({ message: "Patients transferred" });
  } catch (e) {
    next(e);
  }
};

// ================= DELETE USER =================
exports.delete = async (req, res, next) => {
  try {
    await service.deleteUser(req.params.id, req.user.id);
    res.json({ message: "User deleted" });
  } catch (e) {
    next(e);
  }
};

// ================= GET USERS =================
exports.getUsers = async (req, res, next) => {
  try {
    const result = await service.getUsers(req.query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

// ================= UPDATE PROFILE =================
exports.updateProfile = async (req, res) => {
  try {
    const result = await service.updateProfile(req.user.id, req.body);

    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.error || "server_error",
      message: err.message,
      field: err.field || null,
    });
  }
};

// ================= DELETE OWN ACCOUNT (Settings) =================
exports.deleteOwnAccount = async (req, res, next) => {
  try {
    const result = await service.deleteOwnAccount(
      req.user.id,
      req.body.password,
    );
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
};
