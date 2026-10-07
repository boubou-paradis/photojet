// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Téléphone : votes fermés, résultat d'une question, Top 5 de fin et cas
// « aucun résultat ». Uniquement les données du joueur et l'agrégé public.

import VennScore from '../VennScore'
import { serif } from '../PhoneShell'
import { playerRevealLine } from '@/lib/affinity/phrases'
import type { AffinityMatch, AffinityQuestion, AffinityRevealData } from '@/lib/affinity/types'

export function ClosedScreen({ question, myAnswerIndex }: { question: AffinityQuestion; myAnswerIndex: number | null }) {
  return (
    <div className="my-auto text-center">
      <h1 className="text-[28px] font-extrabold leading-tight" style={serif}>Votes fermés, regarde l&apos;écran</h1>
      <p className="text-[15px] text-[#9a94b5] mt-2.5">L&apos;animateur va révéler les réponses de la salle.</p>
      <div className="mt-6 px-4 py-3.5 rounded-[14px] bg-[#d4af37]/10 border border-[#d4af37]/30 text-left text-[15px]">
        <span className="block text-[13px] text-[#9a94b5] mb-0.5">Ta réponse</span>
        {myAnswerIndex !== null ? question.answers[myAnswerIndex] : 'Tu n\'as pas répondu à celle-ci'}
      </div>
    </div>
  )
}

export function RevealResult({ question, reveal, myAnswerIndex }: { question: AffinityQuestion; reveal: AffinityRevealData; myAnswerIndex: number | null }) {
  const line = playerRevealLine(reveal, myAnswerIndex)
  const order = question.answers
    .map((answer, i) => ({ answer, i, percent: reveal.percents[i] ?? 0, count: reveal.counts[i] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.i - b.i)

  return (
    <>
      <div className="my-auto text-center">
        {line.percent !== null && (
          <div className="text-[96px] font-black leading-none text-[#f4d03f]" style={serif}>{line.percent} %</div>
        )}
        <p className="text-[20px] font-bold mt-2">{line.headline}</p>
        <div className="mt-7 flex flex-col gap-2 text-left">
          {order.map(({ answer, i, percent }) => (
            <div key={i} className={`flex justify-between gap-3 text-sm ${i === myAnswerIndex ? 'text-[#f4efe3] font-bold' : 'text-[#9a94b5]'}`}>
              <span className="min-w-0">{answer}</span>
              <span className="flex-none tabular-nums">{percent} %</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-sm text-[#9a94b5]">Regarde l&apos;écran, l&apos;animateur commente !</p>
    </>
  )
}

export function TopMatches({ matches }: { matches: AffinityMatch[] }) {
  return (
    <>
      <h1 className="text-[24px] font-extrabold leading-tight mt-5" style={serif}>Tes 5 meilleurs points communs</h1>
      <ul className="flex flex-col gap-2.5 mt-4">
        {matches.map((m, i) => (
          // Même style pour tout le monde : aucun rang, aucune médaille.
          <li key={`${m.nickname}-${i}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 rounded-[18px] bg-white/[.05] border border-white/10">
            <VennScore score={m.score} />
            <div className="min-w-0">
              <b className="block text-[17px] leading-tight break-words">{m.nickname}</b>
              {m.table && <span className="text-[13px] text-[#9a94b5]">Table {m.table}</span>}
            </div>
            <b className="text-[25px] font-black text-[#f4d03f] tabular-nums leading-none" style={serif}>{m.score} %</b>
            <span className="col-span-3 text-[12.5px] text-[#cfc9e4] pt-1.5 border-t border-white/[.08]">
              {m.identicalAnswers} {m.identicalAnswers > 1 ? 'réponses identiques' : 'réponse identique'} sur {m.comparableAnswers} comparables
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-5 text-center text-sm text-[#9a94b5]">
        Allez vous trouver ! <b className="text-[#f4efe3]">C&apos;est qui, {matches[0].nickname} ?</b>
      </p>
    </>
  )
}

export function NoMatches({ nobodyVisible }: { nobodyVisible: boolean }) {
  return (
    <div className="my-auto text-center">
      <div className="flex justify-center mb-5"><VennScore score={null} width={170} /></div>
      {nobodyVisible ? (
        <>
          <h1 className="text-[26px] font-extrabold leading-tight" style={serif}>Personne n&apos;a choisi d&apos;apparaître dans les résultats ce soir</h1>
          <p className="text-[16px] text-[#cfc9e4] mt-3">Comparez vos réponses de vive voix, c&apos;est encore mieux 😄</p>
        </>
      ) : (
        <>
          <h1 className="text-[26px] font-extrabold leading-tight" style={serif}>Tu as joué la carte de l&apos;originalité ce soir !</h1>
          <p className="text-[16px] text-[#cfc9e4] mt-3">Personne n&apos;a répondu exactement comme toi 😄</p>
        </>
      )}
    </div>
  )
}
