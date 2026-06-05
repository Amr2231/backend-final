const db = require("../../config/db");

// // ================= Register Patient + Create Study =================
// exports.registerPatientWithStudy = async (data) => {
//   const {
//     national_id,
//     first_name,
//     last_name,
//     gender,
//     doctor_id,
//     phone_number,
//     study_type,
//     study_date
//   } = data;

//   // ===== VALIDATION =====
//   if (!national_id) throw { status: 400, message: "national_id is required" };
//   if (!first_name) throw { status: 400, message: "first_name is required" };
//   if (!last_name) throw { status: 400, message: "last_name is required" };
//   if (!gender) throw { status: 400, message: "gender is required" };
//   if (!doctor_id) throw { status: 400, message: "doctor_id is required" };
//   if (!phone_number) throw { status: 400, message: "phone_number is required" };
//   if (!study_type) throw { status: 400, message: "study_type is required" };
//   if (!study_date) throw { status: 400, message: "study_date is required" };

//   if (!/^\d{14}$/.test(national_id)) {
//     throw { status: 400, message: "National ID must be exactly 14 digits" };
//   }

//   if (phone_number.length < 11) {
//     throw { status: 400, message: "Phone number must be at least 11 digits" };
//   }

//   // ===== DUPLICATE CHECK =====
//   const [existing] = await db.query(
//     "SELECT national_id FROM Patients WHERE national_id = ?",
//     [national_id]
//   );

//   if (existing.length) {
//     throw { status: 409, message: "Patient already exists" };
//   }

//   const [phoneExists] = await db.query(
//     "SELECT national_id FROM Patients WHERE phone_number = ?",
//     [phone_number]
//   );

//   if (phoneExists.length) {
//     throw { status: 409, message: "Phone number already used" };
//   }

//   // ===== DOCTOR VALIDATION =====
//   const [doctor] = await db.query(
//     `SELECT
//         u.user_id,
//         u.first_name,
//         u.last_name
//      FROM users u
//      JOIN Roles r ON u.role_id = r.role_id
//      WHERE u.user_id = ?
//        AND r.role_name = 'Doctor'
//        AND u.is_active = 1`,
//     [doctor_id]
//   );

//   if (!doctor.length) {
//     throw { status: 400, message: "Invalid doctor" };
//   }

//   // ===== TRANSACTION =====
//   const conn = await db.getConnection();

//   try {
//     await conn.beginTransaction();

//     // ===== INSERT PATIENT =====
//     await conn.query(
//       `INSERT INTO Patients
//       (
//         national_id,
//         first_name,
//         last_name,
//         gender,
//         phone_number,
//         doctor_id
//       )
//       VALUES (?,?,?,?,?,?)`,
//       [
//         national_id,
//         first_name,
//         last_name,
//         gender,
//         phone_number,
//         doctor_id
//       ]
//     );

//     // ===== INSERT STUDY =====
//     const [studyResult] = await conn.query(
//       `INSERT INTO Studies
//        (
//          national_id,
//          study_type,
//          study_date,
//          status
//        )
//        VALUES (?, ?, ?, 'Scheduled')`,
//       [
//         national_id,
//         study_type,
//         study_date
//       ]
//     );

//     await conn.commit();

//     return {
//       message: "Patient and Study created successfully",
//       patient: {
//         national_id,
//         first_name,
//         last_name,
//         gender,
//         phone_number,
//         doctor_id,
//         doctor_name: `${doctor[0].first_name} ${doctor[0].last_name}`
//       },
//       study: {
//         study_id: studyResult.insertId,
//         study_type,
//         study_date,
//         status: "Scheduled"
//       }
//     };

//   } catch (err) {

//     await conn.rollback();
//     throw err;

//   } finally {

//     conn.release();
//   }
// };
// ================= Register Patient + Create Study =================
exports.registerPatientWithStudy = async (data) => {
  const {
    national_id,
    first_name,
    last_name,
    gender,
    doctor_id,
    phone_number,
    study_type,
    study_date,
  } = data;

  // ===== VALIDATION =====
  if (!national_id) throw { status: 400, message: "national_id is required" };
  if (!first_name) throw { status: 400, message: "first_name is required" };
  if (!last_name) throw { status: 400, message: "last_name is required" };
  if (!gender) throw { status: 400, message: "gender is required" };
  if (!doctor_id) throw { status: 400, message: "doctor_id is required" };
  if (!phone_number) throw { status: 400, message: "phone_number is required" };
  if (!study_type) throw { status: 400, message: "study_type is required" };
  if (!study_date) throw { status: 400, message: "study_date is required" };

  if (!/^\d{14}$/.test(national_id)) {
    throw { status: 400, message: "National ID must be exactly 14 digits" };
  }

  if (phone_number.length < 11) {
    throw { status: 400, message: "Phone number must be at least 11 digits" };
  }

  // ===== DUPLICATE CHECK =====
  const [existing] = await db.query(
    "SELECT national_id FROM patients WHERE national_id = ?",
    [national_id],
  );

  if (existing.length) {
    throw { status: 409, message: "Patient already exists" };
  }

  const [phoneExists] = await db.query(
    "SELECT national_id FROM patients WHERE phone_number = ?",
    [phone_number],
  );

  if (phoneExists.length) {
    throw { status: 409, message: "Phone number already used" };
  }

  // ===== DOCTOR VALIDATION =====
  const [doctor] = await db.query(
    `SELECT 
        u.user_id,
        u.first_name,
        u.last_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.user_id = ?
       AND r.role_name = 'Doctor'
       AND u.is_active = 1`,
    [doctor_id],
  );

  if (!doctor.length) {
    throw { status: 400, message: "Invalid doctor" };
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // ===== INSERT PATIENT =====
    await conn.query(
      `INSERT INTO patients
      (
        national_id,
        first_name,
        last_name,
        gender,
        phone_number,
        doctor_id
      )
      VALUES (?,?,?,?,?,?)`,
      [national_id, first_name, last_name, gender, phone_number, doctor_id],
    );

    // ===== INSERT STUDY =====
    const [studyResult] = await conn.query(
      `INSERT INTO Studies
       (
         national_id,
         study_type,
         study_date,
         status
       )
       VALUES (?, ?, ?, 'Scheduled')`,
      [national_id, study_type, study_date],
    );

    // ===== INSERT APPOINTMENT =====
    await conn.query(
      `INSERT INTO Appointments
       (
         national_id,
         doctor_id,
         appointment_date,
         appointment_time,
         duration_minutes,
         priority_level,
         reason,
         notes,
         created_by,
         status
       )
       VALUES (?, ?, ?, '08:00:00', 30, 'Normal', ?, NULL, ?, 'Scheduled')`,
      [national_id, doctor_id, study_date, study_type, doctor_id],
    );

    await conn.commit();

    const doctorName = `${doctor[0].first_name} ${doctor[0].last_name}`;

    // ===== IMPROVED RESPONSE =====
    return {
      success: true,
      message: "Patient and Study created successfully",

      patient: {
        national_id,
        first_name,
        last_name,
        gender,
        phone_number,
        doctor_id,
        doctor_name: doctorName,
      },

      study: {
        study_id: studyResult.insertId,
        study_type,
        study_date,
        status: "Scheduled",
      },

      // 🔥 EXTRA: useful for frontend linking
      meta: {
        created: true,
        linked_study_id: studyResult.insertId,
        assigned_doctor: doctorName,
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ================= UC-07 Update Patient =================
exports.updatePatient = async (national_id, data) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      national_id: new_national_id,
      first_name,
      last_name,
      gender,
      phone_number,
      doctor_id,
      study_type, // edit by farah
      study_date, // edit by farah
    } = data;

    const [patient] = await connection.query(
      `SELECT *
       FROM patients
       WHERE national_id=?`,
      [national_id],
    );

    if (!patient.length) {
      throw new Error("Patient not found");
    }

    // ===== NATIONAL ID UPDATE =====
    if (new_national_id && new_national_id !== national_id) {
      const [exists] = await connection.query(
        `SELECT national_id
         FROM patients
         WHERE national_id=?`,
        [new_national_id],
      );

      if (exists.length) {
        throw new Error("National ID already exists");
      }

      await connection.query(`SET FOREIGN_KEY_CHECKS=0`);

      await connection.query(
        `UPDATE patients
         SET national_id=?
         WHERE national_id=?`,
        [new_national_id, national_id],
      );

      await connection.query(
        `UPDATE Studies
         SET national_id=?
         WHERE national_id=?`,
        [new_national_id, national_id],
      );

      await connection.query(`SET FOREIGN_KEY_CHECKS=1`);

      national_id = new_national_id;
    }

    // ===== UPDATE PATIENT FIELDS =====
    let fields = [];
    let values = [];

    if (first_name) {
      fields.push("first_name=?");
      values.push(first_name);
    }

    if (last_name) {
      fields.push("last_name=?");
      values.push(last_name);
    }

    if (gender) {
      fields.push("gender=?");
      values.push(gender);
    }

    if (phone_number) {
      fields.push("phone_number=?");
      values.push(phone_number);
    }

    if (doctor_id) {
      fields.push("doctor_id=?");
      values.push(doctor_id);
    }

    if (fields.length) {
      values.push(national_id);

      await connection.query(
        `UPDATE patients
         SET ${fields.join(",")}
         WHERE national_id=?`,
        values,
      );
    }

    // ===== UPDATE STUDY FIELDS [edit by farah] =====
    if (study_type || study_date) {
      const [latestStudy] = await connection.query(
        `SELECT study_id
         FROM Studies
         WHERE national_id = ?
         ORDER BY study_date DESC
         LIMIT 1`,
        [national_id],
      );

      if (latestStudy.length) {
        const studyFields = [];
        const studyValues = [];

        if (study_type) {
          studyFields.push("study_type = ?");
          studyValues.push(study_type);
        }

        if (study_date) {
          studyFields.push("study_date = ?");
          studyValues.push(study_date);
        }

        studyValues.push(latestStudy[0].study_id);

        await connection.query(
          `UPDATE Studies
           SET ${studyFields.join(", ")}
           WHERE study_id = ?`,
          studyValues,
        );
      }
    }

    await connection.commit();

    return {
      message: "Patient updated successfully",
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// ================= UC-08 Delete Patient =================
exports.deletePatient = async (national_id) => {
  if (!national_id) {
    throw { status: 400, message: "national_id is required" };
  }

  const [patient] = await db.query(
    `SELECT national_id, is_active
     FROM patients
     WHERE national_id = ?`,
    [national_id],
  );

  if (!patient.length) {
    throw { status: 404, message: "Patient not found" };
  }

  if (!patient[0].is_active) {
    throw { status: 400, message: "Patient is already deactivated" };
  }

  const [studies] = await db.query(
    `SELECT status
     FROM Studies
     WHERE national_id = ?
     ORDER BY study_date DESC, study_id DESC
     LIMIT 1`,
    [national_id],
  );

  const latestStatus = studies[0]?.status;
  const blockedStatuses = ["Pending", "Viewed", "In Progress"];

  if (latestStatus && blockedStatuses.includes(latestStatus)) {
    throw {
      status: 403,
      message:
        "Cannot deactivate a patient while their study status is Pending or Viewed. Only Scheduled patients can be deactivated.",
    };
  }

  if (latestStatus && latestStatus !== "Scheduled") {
    throw {
      status: 403,
      message:
        "Patient can only be deactivated when the latest study is Scheduled.",
    };
  }

  await db.query(
    `UPDATE patients
     SET is_active = 0
     WHERE national_id = ?`,
    [national_id],
  );

  return {
    success: true,
    message: "Patient deactivated successfully",
  };
};

// ================= Query Patients (Search + Filter + Pagination) =================
exports.queryPatients = async (options) => {
  let {
    keyword,
    study_type,
    date,
    status = "all",
    page = 1,
    limit = 10,
  } = options;

  page = parseInt(page);
  limit = parseInt(limit);

  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 10;

  const offset = (page - 1) * limit;

  let query = `
    SELECT
      p.national_id,
      p.first_name,
      p.last_name,
      p.gender,
      p.phone_number,
      p.doctor_id,
      p.is_active,

      CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,

      s.study_id,
      s.study_type,
      s.study_date,
      s.status

    FROM patients p

    LEFT JOIN users u
      ON p.doctor_id = u.user_id

    LEFT JOIN Studies s
      ON p.national_id = s.national_id

    WHERE 1=1
  `;

  let countQuery = `
    SELECT COUNT(DISTINCT p.national_id) AS total

    FROM patients p

    LEFT JOIN users u
      ON p.doctor_id = u.user_id

    LEFT JOIN Studies s
      ON p.national_id = s.national_id

    WHERE 1=1
  `;

  const params = [];
  const countParams = [];

  // ===== SEARCH =====
  if (keyword) {
    query += `
      AND (
        p.national_id = ?
        OR p.first_name LIKE ?
        OR p.last_name LIKE ?
        OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?
      )
    `;

    countQuery += `
      AND (
        p.national_id = ?
        OR p.first_name LIKE ?
        OR p.last_name LIKE ?
        OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?
      )
    `;

    params.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);

    countParams.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  // ===== FILTER STUDY TYPE =====
  if (study_type) {
    query += ` AND s.study_type = ?`;
    countQuery += ` AND s.study_type = ?`;

    params.push(study_type);
    countParams.push(study_type);
  }

  // ===== FILTER DATE =====
  if (date) {
    query += ` AND DATE(s.study_date) = ?`;
    countQuery += ` AND DATE(s.study_date) = ?`;

    params.push(date);
    countParams.push(date);
  }

  // ===== FILTER STATUS =====
  if (status === "active") {
    query += ` AND p.is_active = 1`;
    countQuery += ` AND p.is_active = 1`;
  }

  if (status === "inactive") {
    query += ` AND p.is_active = 0`;
    countQuery += ` AND p.is_active = 0`;
  }

  // ===== ORDER =====
  query += `
    ORDER BY s.study_date DESC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);

  const [rows] = await db.query(query, params);

  const [countRows] = await db.query(countQuery, countParams);

  return {
    page,
    limit,
    total: countRows[0].total,
    pages: Math.ceil(countRows[0].total / limit),
    data: rows,
  };
};

// ================= UC-07 Reassign / Assign Doctor + Create Study [farah edit] =================
exports.reassignDoctor = async (
  national_id,
  doctor_id,
  study_type,
  study_date,
) => {
  // ===== VALIDATION =====
  if (!national_id) throw new Error("national_id is required");
  if (!doctor_id) throw new Error("doctor_id is required");
  if (!study_type) throw new Error("study_type is required");
  if (!study_date) throw new Error("study_date is required");

  // ===== CHECK PATIENT =====
  const [patient] = await db.query(
    `SELECT national_id, is_active
     FROM patients
     WHERE national_id = ?`,
    [national_id],
  );

  if (!patient.length) {
    throw new Error("Patient not found");
  }

  if (!patient[0].is_active) {
    throw new Error("Patient is inactive");
  }

  // ===== CHECK ACTIVE STUDY =====
  const [activeStudy] = await db.query(
    `SELECT study_id 
     FROM Studies 
     WHERE national_id = ? 
       AND status != 'Completed'
     LIMIT 1`,
    [national_id],
  );

  if (activeStudy.length) {
    throw {
      status: 409,
      message:
        "Patient already has an active study. Cannot reassign until current study is completed.",
    };
  }

  // ===== CHECK DOCTOR =====
  const [doctor] = await db.query(
    `SELECT u.user_id, u.first_name, u.last_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.user_id = ?
       AND r.role_name = 'Doctor'
       AND u.is_active = 1`,
    [doctor_id],
  );

  if (!doctor.length) {
    throw new Error("Doctor not found or inactive");
  }

  // ===== TRANSACTION =====
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE patients SET doctor_id = ? WHERE national_id = ?`,
      [doctor_id, national_id],
    );

    const [studyResult] = await conn.query(
      `INSERT INTO Studies (national_id, study_type, study_date, status)
       VALUES (?, ?, ?, 'Scheduled')`,
      [national_id, study_type, study_date],
    );

    await conn.commit();

    return {
      message: "Doctor reassigned and study created successfully",
      doctor: {
        doctor_id,
        doctor_name: `${doctor[0].first_name} ${doctor[0].last_name}`,
      },
      study: {
        study_id: studyResult.insertId,
        study_type,
        study_date,
        status: "Scheduled",
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ================= UC-34 Active Patients [farah edit] =================
exports.getActivePatients = async (page = 1, limit = 10, options = {}) => {
  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 10;

  const offset = (page - 1) * limit;

  const { keyword, study_type, date, doctor_id, sort, report_status } = options; // farah edit by add sort and report_status

  let baseWhere = `
    WHERE s.status != 'Completed'
      AND p.is_active = 1
  `;

  const params = [];
  const countParams = [];

  // EDIT BY FARAH: delete keyword search by doctor name and add search fullname , NID
  if (keyword) {
    baseWhere += `
      AND (
        p.national_id = ?
        OR p.first_name LIKE ?
        OR p.last_name LIKE ?
        OR CONCAT(p.first_name, ' ', p.last_name) LIKE ?
      )
    `;
    params.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    countParams.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (study_type) {
    baseWhere += ` AND s.study_type = ?`;
    params.push(study_type);
    countParams.push(study_type);
  }

  if (date) {
    baseWhere += ` AND DATE(s.study_date) = ?`;
    params.push(date);
    countParams.push(date);
  }

  if (doctor_id) {
    baseWhere += ` AND p.doctor_id = ?`;
    params.push(doctor_id);
    countParams.push(doctor_id);
  }
  // farah edit by add report_status
  if (report_status) {
    baseWhere += ` AND r.report_status = ?`;
    params.push(report_status);
    countParams.push(report_status);
  }

  // ===== ORDER =====
  const orderDir = sort === "oldest" ? "ASC" : "DESC"; // farah edit by add sort

  const [rows] = await db.query(
    // farah edit by add report_status and add sort by date (newest or oldest) [order dir]
    `
SELECT
    p.national_id,
    p.first_name,
    p.last_name,
    p.gender,
    p.phone_number,
    p.doctor_id,
    p.is_active,
    CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
    s.study_id,
    s.study_type,
    s.study_date,
    s.status,
    r.report_status

  FROM patients p

  JOIN Studies s
    ON p.national_id = s.national_id

  LEFT JOIN users u
    ON p.doctor_id = u.user_id

    LEFT JOIN Reports r ON r.study_id = s.study_id 
  ${baseWhere}

  ORDER BY s.study_date ${orderDir}
  LIMIT ? OFFSET ?
  `,
    [...params, limit, offset],
  );

  // ===== COUNT [farah edit by add report_status] =====
  const [count] = await db.query(
    `
    SELECT COUNT(*) AS total

    FROM patients p

    JOIN Studies s
      ON p.national_id = s.national_id

    LEFT JOIN users u
      ON p.doctor_id = u.user_id

      LEFT JOIN Reports r ON r.study_id = s.study_id

    ${baseWhere}
    `,
    countParams,
  );

  return {
    page,
    limit,
    total: count[0].total,
    pages: Math.ceil(count[0].total / limit),
    data: rows,
  };
};

// ================= UC-36 Historical Patients [farah edit by add status] =================
exports.getHistoricalPatients = async (page = 1, limit = 10, options = {}) => {
  // farah edit by add options
  page = parseInt(page);
  limit = parseInt(limit);

  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 10; // farah edit by add limit validation
  const offset = (page - 1) * limit;

  const { keyword, study_type, date, sort } = options; // farah edit by add keyword, study_type, date , sort
  let baseWhere = `WHERE s.status = 'Completed'`; // farah edit by add baswhere with status
  const params = []; // farah edit by add params
  const countParams = []; // farah edit by add count params

  if (keyword) {
    // farah edit by add search by patient name and NID and remove search by doctor name
    baseWhere += `
      AND (
        p.national_id = ?
        OR p.first_name LIKE ?
        OR p.last_name LIKE ?
        OR CONCAT(p.first_name, ' ', p.last_name) LIKE ?
      )
    `;
    params.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    countParams.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (study_type) {
    baseWhere += ` AND s.study_type = ?`;
    params.push(study_type);
    countParams.push(study_type);
  }

  if (date) {
    baseWhere += ` AND DATE(s.study_date) = ?`;
    params.push(date);
    countParams.push(date);
  }
  const orderDir = sort === "oldest" ? "ASC" : "DESC"; // farah edit by add sort by date (newest or oldest) [order dir]
  const [rows] = await db.query(
    // farah edit by add sort by gender and remove search by doctor
    `
    SELECT
      p.national_id,
      p.first_name,
      p.last_name,
      p.phone_number,
      p.doctor_id,
      p.gender,
      CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
      s.study_id,
      s.study_type,
      s.study_date,
      s.status

    FROM patients p
    JOIN Studies s ON p.national_id = s.national_id
    LEFT JOIN users u ON p.doctor_id = u.user_id

    ${baseWhere}

    ORDER BY s.study_date ${orderDir}
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset],
  ); // farah edit by add sort by date (newest or oldest) [order dir]

  const [count] = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM patients p
    JOIN Studies s ON p.national_id = s.national_id
    LEFT JOIN users u ON p.doctor_id = u.user_id
    ${baseWhere}
    `,
    countParams,
  ); // farah edit by add count params , basewhere with status

  return {
    page,
    limit,
    total: count[0].total,
    pages: Math.ceil(count[0].total / limit),
    data: rows,
  };
};

// ================= UC-17 Assigned Patients =================
exports.getAssignedPatients = async (
  doctor_id,
  page = 1,
  limit = 10,
  options = {},
) => {
  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1; // farah edit by add page validation
  if (limit < 1 || limit > 100) limit = 10; // farah edit by add limit validation

  const offset = (page - 1) * limit;
  const { keyword, study_type, date, sort, report_status } = options; // farah edit by add keyword, study_type, date , sort , report_status

  // ===== VALIDATE DOCTOR =====
  const [doctor] = await db.query(
    `
    SELECT u.user_id
    FROM users u
    JOIN roles r
      ON u.role_id = r.role_id
    WHERE u.user_id=?
      AND r.role_name='Doctor'
      AND u.is_active=1
    `,
    [doctor_id],
  );

  if (!doctor.length) {
    throw {
      status: 403,
      message: "Invalid or inactive doctor",
    };
  }

  // ===== BASE WHERE =====
  let baseWhere = `
    WHERE p.doctor_id = ?
      AND p.is_active = 1
      AND s.status != 'Completed'
  `; // farah edit by add status filter
  const params = [doctor_id]; // farah edit by add doctor_id to params
  const countParams = [doctor_id]; // farah edit by add doctor_id to count params

  // ===== SEARCH =====
  if (keyword) {
    baseWhere += `
      AND (
        p.national_id = ?
        OR p.first_name LIKE ?
        OR p.last_name LIKE ?
        OR CONCAT(p.first_name, ' ', p.last_name) LIKE ?
      )
    `;
    params.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    countParams.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  } // added by farah search by patient name and NID

  // ===== FILTER STUDY TYPE =====
  if (study_type) {
    baseWhere += ` AND s.study_type = ?`;
    params.push(study_type);
    countParams.push(study_type);
  } // added by farah filter by study type

  // ===== FILTER DATE [added by farah] =====
  if (date) {
    baseWhere += ` AND DATE(s.study_date) = ?`;
    params.push(date);
    countParams.push(date);
  } // added by farah filter by study date

  // ===== FILTER REPORT STATUS [added by farah] =====
  if (report_status) {
    if (report_status === "not_written") {
      baseWhere += ` AND r.report_status IS NULL`;
      // مش بنضيف params هنا
    } else {
      baseWhere += ` AND r.report_status = ?`;
      params.push(report_status);
      countParams.push(report_status);
    }
  }

  // ===== SORT [added by farah] =====
  const orderDir = sort === "oldest" ? "ASC" : "DESC";
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  // ===== QUERY [added by farah] =====
  const [rows] = await db.query(
    `
    SELECT
      p.national_id,
      p.first_name,
      p.last_name,
      p.phone_number,
      p.gender,
      p.is_active,
      CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
      s.study_id,
      s.study_type,
      s.study_date,
      s.notes,
      s.status AS study_status
    FROM patients p
    JOIN Studies s ON p.national_id = s.national_id
    LEFT JOIN users u ON p.doctor_id = u.user_id
    LEFT JOIN Reports r ON r.study_id = s.study_id
    ${baseWhere}
    ORDER BY s.study_date ${orderDir}
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset],
  );

  // ===== COUNT [edited by farah] =====
  const [count] = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM patients p
    JOIN Studies s ON p.national_id = s.national_id
    LEFT JOIN Reports r ON r.study_id = s.study_id
    ${baseWhere}
    `,
    countParams,
  );

  // ===== LOAD IMAGES + REPORTS =====
  const result = [];

  for (const patient of rows) {
    const [images] = await db.query(
      `SELECT image_id, view_type, file_path, file_format
       FROM Images WHERE study_id = ?`,
      [patient.study_id],
    );

    const [reports] = await db.query(
      `SELECT report_id, report_status, created_at
       FROM Reports WHERE study_id = ?`,
      [patient.study_id],
    );

    const formattedReports = reports.map((r) => ({
      report_id: r.report_id,
      report_status: r.report_status,
      created_at: r.created_at,
      report_url: r.report_id ? `${baseUrl}/reports/pdf/${r.report_id}` : null,
    }));

    result.push({
      national_id: patient.national_id,
      first_name: patient.first_name,
      last_name: patient.last_name,
      phone_number: patient.phone_number,
      gender: patient.gender,
      is_active: patient.is_active,
      doctor_name: patient.doctor_name,
      study: {
        study_id: patient.study_id,
        study_type: patient.study_type,
        study_date: patient.study_date,
        status: patient.study_status,
        notes: patient.notes ? JSON.parse(patient.notes) : [],
        images,
        reports: formattedReports,
      },
    });
  }

  // ===== RETURN ✅ =====
  return {
    success: true,
    page,
    limit,
    total: count[0].total,
    pages: Math.ceil(count[0].total / limit),
    patients: result,
  };
};

// ================= GET PATIENT BY STUDY ID (Doctor — includes completed studies) =================
exports.getPatientByStudyId = async (doctor_id, study_id) => {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  const [rows] = await db.query(
    `
    SELECT
      p.national_id,
      p.first_name,
      p.last_name,
      p.phone_number,
      p.gender,
      p.is_active,
      CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
      s.study_id,
      s.study_type,
      s.study_date,
      s.notes,
      s.status AS study_status,
      r.report_status
    FROM Studies s
    JOIN patients p ON s.national_id = p.national_id
    LEFT JOIN users u ON p.doctor_id = u.user_id
    LEFT JOIN Reports r ON r.study_id = s.study_id
    WHERE s.study_id = ? AND p.doctor_id = ?
    LIMIT 1
    `,
    [study_id, doctor_id],
  );

  if (!rows.length) {
    throw { status: 404, message: "Study not found for this doctor" };
  }

  const patient = rows[0];

  const [images] = await db.query(
    `SELECT image_id, view_type, file_path, file_format
     FROM Images WHERE study_id = ?`,
    [patient.study_id],
  );

  const [reports] = await db.query(
    `SELECT report_id, report_status, created_at
     FROM Reports WHERE study_id = ?`,
    [patient.study_id],
  );

  const formattedReports = reports.map((r) => ({
    report_id: r.report_id,
    report_status: r.report_status,
    created_at: r.created_at,
    report_url: r.report_id ? `${baseUrl}/reports/pdf/${r.report_id}` : null,
  }));

  return {
    national_id: patient.national_id,
    first_name: patient.first_name,
    last_name: patient.last_name,
    phone_number: patient.phone_number,
    gender: patient.gender,
    is_active: patient.is_active,
    doctor_name: patient.doctor_name,
    study: {
      study_id: patient.study_id,
      study_type: patient.study_type,
      study_date: patient.study_date,
      status: patient.study_status,
      notes: patient.notes ? JSON.parse(patient.notes) : [],
      images,
      reports: formattedReports,
    },
  };
};

// ================= GET DEACTIVATED PATIENTS (Admin) [created by farah] =================
exports.getDeactivatedPatients = async (page = 1, limit = 10, options = {}) => {
  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 10;

  const offset = (page - 1) * limit;
  const { keyword, sort } = options;

  let baseWhere = `WHERE p.is_active = 0`;
  const params = [];
  const countParams = [];

  if (keyword) {
    baseWhere += `
      AND (
        p.national_id = ?
        OR p.first_name LIKE ?
        OR p.last_name LIKE ?
        OR CONCAT(p.first_name, ' ', p.last_name) LIKE ?
      )
    `;
    params.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    countParams.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const orderDir = sort === "oldest" ? "ASC" : "DESC";

  const [rows] = await db.query(
    `
    SELECT
      p.national_id,
      p.first_name,
      p.last_name,
      p.gender,
      p.phone_number,
      p.doctor_id,
      CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
      s.study_id,
      s.study_type,
      s.study_date,
      s.status AS study_status
    FROM patients p
    LEFT JOIN users u ON p.doctor_id = u.user_id
    LEFT JOIN Studies s ON p.national_id = s.national_id
    ${baseWhere}
    ORDER BY s.study_date ${orderDir}
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset],
  );

  const [count] = await db.query(
    `
    SELECT COUNT(DISTINCT p.national_id) AS total
    FROM patients p
    ${baseWhere}
    `,
    countParams,
  );

  return {
    page,
    limit,
    total: count[0].total,
    pages: Math.ceil(count[0].total / limit),
    data: rows,
  };
};

// ================= REACTIVATE PATIENT (Admin) =================
exports.reactivatePatient = async (national_id) => {
  const [patient] = await db.query(
    `SELECT national_id, is_active FROM Patients WHERE national_id = ?`,
    [national_id],
  );

  if (!patient.length) throw new Error("Patient not found");
  if (patient[0].is_active) throw new Error("Patient is already active");

  await db.query(`UPDATE Patients SET is_active = 1 WHERE national_id = ?`, [
    national_id,
  ]);

  return { message: "Patient reactivated successfully" };
};

// ================= Historical Patients for Doctor [created by farah] =================
exports.getDoctorHistoricalPatients = async (
  doctor_id,
  page = 1,
  limit = 10,
  options = {},
) => {
  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 10;
  const offset = (page - 1) * limit;

  const { keyword, study_type, date, sort, report_status } = options;

  let baseWhere = `WHERE s.status = 'Completed' AND p.doctor_id = ?`;
  const params = [doctor_id];
  const countParams = [doctor_id];

  if (keyword) {
    baseWhere += ` AND (p.national_id = ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR CONCAT(p.first_name, ' ', p.last_name) LIKE ?)`;
    params.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    countParams.push(keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (study_type) {
    baseWhere += ` AND s.study_type = ?`;
    params.push(study_type);
    countParams.push(study_type);
  }
  if (date) {
    baseWhere += ` AND DATE(s.study_date) = ?`;
    params.push(date);
    countParams.push(date);
  }
  if (report_status) {
    if (report_status === "not_written") {
      baseWhere += ` AND r.report_status IS NULL`;
    } else {
      baseWhere += ` AND r.report_status = ?`;
      params.push(report_status);
      countParams.push(report_status);
    }
  }

  const orderDir = sort === "oldest" ? "ASC" : "DESC";

  const [rows] = await db.query(
    `SELECT
      p.national_id, p.first_name, p.last_name, p.phone_number,
      p.doctor_id, p.gender,
      CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
      s.study_id, s.study_type, s.study_date, s.status,
      r.report_status
    FROM patients p
    JOIN Studies s ON p.national_id = s.national_id
    LEFT JOIN users u ON p.doctor_id = u.user_id
    LEFT JOIN Reports r ON r.study_id = s.study_id
    ${baseWhere}
    ORDER BY s.study_date ${orderDir}
    LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [count] = await db.query(
    `SELECT COUNT(*) AS total
     FROM patients p
     JOIN Studies s ON p.national_id = s.national_id
     LEFT JOIN users u ON p.doctor_id = u.user_id
     LEFT JOIN Reports r ON r.study_id = s.study_id
     ${baseWhere}`,
    countParams,
  );

  return {
    success: true,
    page,
    limit,
    total: count[0].total,
    pages: Math.ceil(count[0].total / limit),
    data: rows,
  };
};

// ================= Recent Patients for Doctor [created by farah]=================
exports.getRecentPatients = async (doctor_id, page = 1, limit = 20) => {
  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 20;
  const offset = (page - 1) * limit;

  const [rows] = await db.query(
    `SELECT
      p.national_id, p.first_name, p.last_name,
      p.phone_number, p.gender,
      CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
      s.study_id, s.study_type, s.study_date, s.status,
      r.report_status
    FROM patients p
    JOIN Studies s ON p.national_id = s.national_id
    LEFT JOIN users u ON p.doctor_id = u.user_id
    LEFT JOIN Reports r ON r.study_id = s.study_id
    WHERE p.doctor_id = ? AND p.is_active = 1
    ORDER BY s.study_date DESC
    LIMIT ? OFFSET ?`,
    [doctor_id, limit, offset],
  );

  const [count] = await db.query(
    `SELECT COUNT(*) AS total
     FROM patients p
     JOIN Studies s ON p.national_id = s.national_id
     WHERE p.doctor_id = ? AND p.is_active = 1`,
    [doctor_id],
  );

  return {
    success: true,
    page,
    limit,
    total: count[0].total,
    pages: Math.ceil(count[0].total / limit),
    data: rows,
  };
};
