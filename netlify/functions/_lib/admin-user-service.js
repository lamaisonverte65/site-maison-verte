export async function provisionHousekeepingUser({ repository, auth, profile, createdBy }) {
  const existingProfile = await repository.findProfileByEmail(profile.email);
  if (existingProfile) {
    return { ok: false, statusCode: 409, error: "Un profil interne utilise déjà cet email." };
  }

  const existingAuthUser = await auth.findUserByEmail(profile.email);
  if (existingAuthUser) {
    return {
      ok: false,
      statusCode: 409,
      error: "Un compte Auth existant doit être associé par l'opération propriétaire dédiée.",
      identityConflict: true,
    };
  }

  const authUser = await auth.createUser({
    email: profile.email,
    password: profile.temporaryPassword,
    email_confirm: true,
    user_metadata: { admin_role: "housekeeping", display_name: profile.display_name },
    app_metadata: { admin_role: "housekeeping" },
  });

  const adminProfile = {
    email: profile.email,
    display_name: profile.display_name,
    role: "housekeeping",
    is_owner: false,
    is_active: true,
    auth_user_id: authUser.id,
    password_initialized: false,
    temporary_password_set_at: new Date().toISOString(),
    created_by: createdBy,
    updated_at: new Date().toISOString(),
  };

  try {
    const insertedProfile = await repository.insertProfile(adminProfile);
    return { ok: true, profile: insertedProfile };
  } catch {
    let persistedProfile;
    try {
      persistedProfile = await repository.findProfileByEmail(profile.email);
    } catch {
      return {
        ok: false,
        statusCode: 500,
        error: "L'état de l'insertion est ambigu ; aucune suppression Auth automatique n'a été tentée.",
        compensated: false,
        reconciliationRequired: true,
        createdAuthUserId: authUser.id,
      };
    }
    if (persistedProfile?.auth_user_id === authUser.id) {
      return { ok: true, profile: persistedProfile, recoveredAfterAmbiguousInsert: true };
    }
    try {
      await auth.deleteUser(authUser.id);
      return {
        ok: false,
        statusCode: 500,
        error: "Création annulée après l'échec de l'enregistrement du compte ménage.",
        compensated: true,
      };
    } catch {
      return {
        ok: false,
        statusCode: 500,
        error: "Le profil n'a pas été créé et le compte Auth temporaire doit être supprimé manuellement.",
        compensated: false,
        authCleanupRequired: true,
        createdAuthUserId: authUser.id,
      };
    }
  }
}
