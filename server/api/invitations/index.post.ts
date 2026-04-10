import { useSupabaseClient } from '../../utils/supabase'
import { Resend } from 'resend'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  if (!body.email) throw createError({ statusCode: 400, message: 'Email requis' })

  const supabase = useSupabaseClient()

  // Check if already has a partner
  const { data: currentUser } = await supabase
    .from('users')
    .select('partner_id, display_name')
    .eq('id', session.user.id)
    .single()

  if (currentUser?.partner_id) throw createError({ statusCode: 400, message: 'Vous avez déjà un partenaire' })

  // Cancel previous pending invitations from this user
  await supabase
    .from('partner_invitations')
    .update({ status: 'expired' })
    .eq('inviter_id', session.user.id)
    .eq('status', 'pending')

  const { data, error } = await supabase
    .from('partner_invitations')
    .insert({ inviter_id: session.user.id, invitee_email: body.email })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  // Send invitation email
  const config = useRuntimeConfig()
  const resend = new Resend(config.resendApiKey)
  const inviteUrl = `${getRequestURL(event).origin}/invite/${data.token}`
  const inviterName = currentUser?.display_name ?? session.user.name ?? 'Quelqu un'

  await resend.emails.send({
    from: 'Spor <onboarding@resend.dev>',
    to: body.email,
    subject: `${inviterName} vous invite sur Spor`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="font-size:24px;font-weight:700;color:#18181b">🏋️ Invitation Spor</h1>
        <p style="color:#52525b;margin:16px 0">
          <strong>${inviterName}</strong> vous invite à rejoindre Spor pour suivre vos entraînements ensemble.
        </p>
        <a href="${inviteUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Accepter l'invitation
        </a>
        <p style="color:#a1a1aa;font-size:12px;margin-top:24px">
          Ce lien expire dans 7 jours.
        </p>
      </div>
    `
  })

  return data
})
