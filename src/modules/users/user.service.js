const db = require("../../config/db").default;
const argon2 = require("argon2");

// ================= Helper: Get User By ID [created by farah] =================
const getUserById = async (id) => {
  const [rows] = await db.query(
    `
    SELECT
      u.*,
      r.role_name
    FROM Users u
    JOIN Roles r
      ON u.role_id = r.role_id
    WHERE u.user_id=?
    `,
    [id],
  );

  return rows[0] || null;
};

// ================= Create User =================
exports.createUser = async ({
  first_name,
  last_name,
  username,
  email,
  password,
  confirm_password,
  role_name,
}) => {
  // ================= VALIDATION =================
  if (
    !first_name ||
    !last_name ||
    !username ||
    !email ||
    !password ||
    !confirm_password ||
    !role_name
  ) {
    throw { status: 400, message: "All fields are required" };
  }

  if (!email.includes("@")) {
    throw { status: 400, message: "Invalid email format" };
  }

  // ✅ Confirm Password Check
  if (password !== confirm_password) {
    throw {
      status: 400,
      message: "Password and confirm password do not match",
    };
  }

  // Optional strong password check
  if (password.length < 8) {
    throw { status: 400, message: "Password must be at least 8 characters" };
  }

  // ================= CHECK EMAIL =================
  const [exists] = await db.query("SELECT user_id FROM Users WHERE email=?", [
    email,
  ]);

  if (exists.length) {
    throw { status: 409, message: "Email already exists" };
  }

  // ================= CHECK ROLE =================
  const [role] = await db.query("SELECT role_id FROM Roles WHERE role_name=?", [
    role_name,
  ]);

  if (!role.length) {
    throw { status: 400, message: "Invalid role" };
  }

  // ================= HASH PASSWORD =================
  const hash = await argon2.hash(password);

  // ================= INSERT USER =================
  await db.query(
    `INSERT INTO Users 
        (first_name, last_name, username, email, password_hash, role_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
    [first_name, last_name, username, email, hash, role[0].role_id],
  );

  return {
    message: "User created successfully",
  };
};

// ================= UC-15 Update User =================
exports.updateUser = async (id, data) => {
  const [rows] = await db.query("SELECT * FROM Users WHERE user_id=?", [id]);

  if (!rows.length) throw new Error("User not found");

  const user = rows[0];

  const first_name = data.first_name ?? user.first_name;
  const last_name = data.last_name ?? user.last_name;
  const username = data.username ?? user.username;
  const email = data.email ?? user.email;

  await db.query(
    `UPDATE Users 
         SET first_name=?, last_name=?, username=?, email=? 
         WHERE user_id=?`,
    [first_name, last_name, username, email, id],
  );
};

// ================= UC-28 Deactivate =================
// delete validation of doctor to activate direct [edit by farah]
exports.deactivateUser = async (id) => {
  const [user] = await db.query(
    `SELECT u.*, r.role_name
         FROM Users u
         JOIN Roles r ON u.role_id = r.role_id
         WHERE u.user_id=?`,
    [id],
  );

  if (!user.length) {
    throw {
      status: 404,
      message: "User not found",
    };
  } // edit farah

  await db.query(
    `
    UPDATE Users
    SET is_active=0
    WHERE user_id=?
    `,
    [id],
  );
  return {
    message: "User deactivated successfully",
  };
};

// ================= UC-29 Reactivate =================
exports.reactivateUser = async (id) => {
  const [user] = await db.query("SELECT * FROM Users WHERE user_id=?", [id]);

  if (!user.length) {
    throw {
      status: 404,
      message: "User not found",
    };
  } // edit farah
  if (user[0].is_active)
    throw {
      status: 400,
      message: "Target doctor is invalid or inactive",
    }; // edit farah

  await db.query("UPDATE Users SET is_active=1 WHERE user_id=?", [id]);
  return {
    message: "User reactivated successfully",
  };
};

// ================= UC-30 Transfer Patients =================
exports.transferPatients = async (oldDoctor, newDoctor) => {
  // VALIDATION
  if (oldDoctor === newDoctor) {
    throw {
      status: 400,
      message: "Cannot transfer patients to the same doctor",
    };
  }

  // CHECK OLD DOCTOR
  const sourceDoctor = await getUserById(oldDoctor);

  //   if (!newDoc.length) throw new Error("New doctor invalid or inactive");

  // ================= CHECK NEW DOCTOR =================
  const targetDoctor = await getUserById(newDoctor);

  if (!targetDoctor || targetDoctor.role_name !== "Doctor") {
    throw { status: 404, message: "Target doctor not found" };
  } // edit farah by check if target doctor is valid and active

  //   const [patients] = await db.query(
  //     "SELECT * FROM Patients WHERE doctor_id=?",
  //     [oldDoctor],
  //   );

  //   CHECK PATIENTS EXIST
  const [patients] = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM Patients
    WHERE doctor_id=?
    `,
    [oldDoctor],
  );

  if (patients[0].total === 0) {
    throw {
      status: 400,
      message: "This doctor has no patients to transfer",
    };
  } // edit farah by add status and message

  // TRANSFER
  await db.query("UPDATE Patients SET doctor_id=? WHERE doctor_id=?", [
    newDoctor,
    oldDoctor,
  ]);
  return {
    message:
      "Patients transferred successfully. Doctor is now ready for deletion.",
  };
};

// ================= UC-31 Validate doctor before deactivate =================
const validateDoctorHasNoPatients = async (doctor_id) => {
  const [patients] = await db.query(
    "SELECT COUNT(*) AS count FROM Patients WHERE doctor_id=?",
    [doctor_id],
  );

  if (patients[0].count > 0) {
    throw new Error(
      "Doctor has assigned patients. Please transfer them first.",
    );
  }
};

const assertDoctorCanBeDeleted = async (id) => {
  const [patients] = await db.query(
    `SELECT COUNT(*) AS total FROM Patients WHERE doctor_id = ?`,
    [id],
  );

  if (patients[0].total > 0) {
    throw {
      status: 400,
      message:
        "Doctor still has assigned patients. Transfer patients before deletion.",
    };
  }
};

const performUserDeletion = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM FollowUpReminders WHERE doctor_id = ?`, [id]);
    await conn.query(`DELETE FROM Watchlist WHERE doctor_id = ?`, [id]);
    await conn.query(`DELETE FROM DoctorAvailability WHERE doctor_id = ?`, [id]);
    await conn.query(`DELETE FROM DoctorSchedules WHERE doctor_id = ?`, [id]);
    await conn.query(`DELETE FROM DoctorHolidays WHERE doctor_id = ?`, [id]);
    await conn.query(`DELETE FROM UserPresence WHERE user_id = ?`, [id]);
    await conn.query(
      `UPDATE AI_Validation SET validated_by = NULL WHERE validated_by = ?`,
      [id],
    );
    await conn.query(
      `DELETE FROM InternalMessages WHERE sender_id = ? OR receiver_id = ?`,
      [id, id],
    );
    await conn.query(`DELETE FROM Notifications WHERE user_id = ?`, [id]);
    await conn.query(
      `UPDATE Users SET refresh_token = NULL, refresh_token_expiry = NULL WHERE user_id = ?`,
      [id],
    );
    await conn.query(`DELETE FROM Users WHERE user_id = ?`, [id]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw {
      status: 500,
      message: "Unable to delete user due to related records. Please try again.",
    };
  } finally {
    conn.release();
  }

  return {
    message: "User deleted successfully",
  };
};

// ================= Delete User =================
exports.deleteUser = async (id, requestingUserId = null) => {
  const user = await getUserById(id);

  if (!user) {
    throw {
      status: 404,
      message: "User not found",
    };
  }

  if (requestingUserId && Number(requestingUserId) === Number(id)) {
    throw {
      status: 403,
      message: "You cannot delete your own account from user management. Use Settings to delete your account.",
    };
  }

  if (user.role_name === "Doctor") {
    await assertDoctorCanBeDeleted(id);
  }

  return performUserDeletion(id);
};

// ================= Delete Own Account (Settings) =================
exports.deleteOwnAccount = async (userId, password) => {
  if (!password || typeof password !== "string") {
    throw {
      status: 400,
      message: "Password is required to delete your account",
    };
  }

  const user = await getUserById(userId);

  if (!user) {
    throw {
      status: 404,
      message: "User not found",
    };
  }

  const valid = await argon2.verify(user.password_hash, password);
  if (!valid) {
    throw {
      status: 401,
      message: "Invalid password",
    };
  }

  if (user.role_name === "Doctor") {
    await assertDoctorCanBeDeleted(userId);
  }

  return performUserDeletion(userId);
};

// ================= Get Users =================
exports.getUsers = async (filters) => {
  let {
    status = "all",
    role,
    keyword,
    page = 1,
    limit = 10,
    sort = "created_at",
    order = "DESC",
    created_date, // farah edit by add filter by created date
  } = filters;

  // ================= PAGINATION =================
  page = parseInt(page);
  limit = parseInt(limit);

  if (page < 1 || isNaN(page)) {
    page = 1;
  }

  if (limit < 1 || limit > 100 || isNaN(limit)) {
    limit = 10;
  }

  const offset = (page - 1) * limit;

  // ================= BASE QUERY =================
  let query = `
        SELECT
            u.user_id,
            u.first_name,
            u.last_name,
            u.username,
            u.email,
            u.created_at,
            u.is_active,
            r.role_name
        FROM Users u
        JOIN Roles r
            ON u.role_id = r.role_id
        WHERE 1=1
    `;

  let countQuery = `
        SELECT COUNT(*) AS total
        FROM Users u
        JOIN Roles r
            ON u.role_id = r.role_id
        WHERE 1=1
    `;

  const params = [];
  const countParams = [];

  // ================= STATUS FILTER =================
  if (status === "active") {
    query += ` AND u.is_active = 1`;
    countQuery += ` AND u.is_active = 1`;
  }

  if (status === "deactivated") {
    query += ` AND u.is_active = 0`;
    countQuery += ` AND u.is_active = 0`;
  }

  // ================= ROLE FILTER =================
  if (role) {
    query += ` AND r.role_name = ?`;
    countQuery += ` AND r.role_name = ?`;

    params.push(role);
    countParams.push(role);
  }

  // ================= KEYWORD SEARCH =================
  if (keyword) {
    // farah edit by concat first and last name instead of search by firstname or lastname , remove search by email
    query += `
            AND (
               CONCAT(u.first_name, ' ', u.last_name) LIKE ?
                OR u.username LIKE ?
            )
        `;

    countQuery += `
            AND (
                CONCAT(u.first_name, ' ', u.last_name) LIKE ?
                OR u.username LIKE ?
            )
        `;

    const searchValue = `%${keyword}%`;

    params.push(searchValue, searchValue);

    countParams.push(searchValue, searchValue);
  }

  // ================= SORTING =================
  const allowedSort = [
    "created_at",
    "username",
    "email",
    "first_name",
    "last_name",
  ];

  // ================= DATE FILTER [create by farah edit by add filter by created date] =================
  if (created_date) {
    query += ` AND DATE(u.created_at) = ?`;
    countQuery += ` AND DATE(u.created_at) = ?`;
    params.push(created_date);
    countParams.push(created_date);
  }

  if (!allowedSort.includes(sort)) {
    sort = "created_at";
  }

  order = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

  query += ` ORDER BY u.${sort} ${order}`;

  // ================= PAGINATION =================
  query += ` LIMIT ? OFFSET ?`;

  params.push(limit, offset);

  // ================= EXECUTE =================
  const [rows] = await db.query(query, params);

  const [countRows] = await db.query(countQuery, countParams);

  const total = countRows[0].total;

  // ================= RESPONSE =================
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    data: rows,
  };
};

// ================= UPDATE PROFILE (Settings Page) =================
// PATCH /users/profile
exports.updateProfile = async (authUserId, data) => {
  const { first_name, last_name, email, username } = data; // farah edit by add username in update profile in settings page

  // ================= CHECK USER =================
  const [userRows] = await db.query(
    `SELECT 
            u.user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.created_at,
            u.is_active,
            r.role_name
         FROM Users u
         JOIN Roles r ON u.role_id = r.role_id
         WHERE u.user_id = ?`,
    [authUserId],
  );

  if (!userRows.length) {
    throw {
      status: 404,
      message: "User not found",
    };
  }

  const user = userRows[0];

  // ================= VALIDATION =================
  if (
    first_name === undefined &&
    last_name === undefined &&
    email === undefined &&
    username === undefined // farah edit by add username in update profile in settings page
  ) {
    throw {
      status: 400,
      message: "No fields provided",
    };
  }

  // ================= FIRST NAME =================
  if (first_name !== undefined) {
    if (
      typeof first_name !== "string" ||
      first_name.trim().length < 1 ||
      first_name.trim().length > 20
    ) {
      throw {
        status: 422,
        error: "validation_failed",
        message: "First name must be 1 to 20 characters.",
        field: "first_name",
      };
    }
  }

  // ================= LAST NAME =================
  if (last_name !== undefined) {
    if (
      typeof last_name !== "string" ||
      last_name.trim().length < 1 ||
      last_name.trim().length > 20
    ) {
      throw {
        status: 422,
        error: "validation_failed",
        message: "Last name must be 1 to 20 characters.",
        field: "last_name",
      };
    }
  }

  //   ================= USERNAME =================
  if (username !== undefined) {
    if (
      typeof username !== "string" ||
      username.trim().length < 3 ||
      username.trim().length > 30
    ) {
      throw {
        status: 422,
        error: "validation_failed",
        message: "Username must be 3 to 30 characters.",
        field: "username",
      };
    }
    const [existsUsername] = await db.query(
      `SELECT user_id FROM Users WHERE username = ? AND user_id != ?`,
      [username.trim(), authUserId],
    );

    if (existsUsername.length) {
      throw {
        status: 422,
        error: "validation_failed",
        message: "Username is already taken.",
        field: "username",
      };
    }
  }

  // ================= EMAIL =================
  if (email !== undefined) {
    const emailRegex = /\S+@\S+\.\S+/;

    if (!emailRegex.test(email)) {
      throw {
        status: 422,
        error: "validation_failed",
        message: "Invalid email format.",
        field: "email",
      };
    }

    const [exists] = await db.query(
      `SELECT user_id
             FROM Users
             WHERE email = ?
             AND user_id != ?`,
      [email.trim(), authUserId],
    );

    if (exists.length) {
      throw {
        status: 422,
        error: "validation_failed",
        message: "The email address is already in use.",
        field: "email",
      };
    }
  }

  // ================= FINAL VALUES =================
  const newFirstName =
    first_name !== undefined ? first_name.trim() : user.first_name;

  const newLastName =
    last_name !== undefined ? last_name.trim() : user.last_name;

  const newUsername = username?.trim() ?? user.username; // farah edit by add update username in settings page

  const newEmail = email !== undefined ? email.trim() : user.email;

  // ================= UPDATE [edited by farah add username] =================
  await db.query(
    `UPDATE Users
         SET first_name = ?,
             last_name = ?,
             username   = ?,
             email = ?
         WHERE user_id = ?`,
    [newFirstName, newLastName, newUsername, newEmail, authUserId],
  );

  // ================= RESPONSE =================
  return {
    id: user.user_id,
    first_name: newFirstName,
    last_name: newLastName,
    First_name: newFirstName,
    Last_name: newLastName,
    username: newUsername,
    email: newEmail,
    status: user.is_active ? "active" : "deactivated",
    created_at: user.created_at,
    role: user.role_name,
  };
};
