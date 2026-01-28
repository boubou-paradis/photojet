// Quiz pré-packagés pour AnimaJet
// 5 thèmes x 15 questions = 75 questions prêtes à l'emploi

export interface PrepackagedQuestion {
  question: string
  answers: [string, string, string, string]
  correctAnswer: number // 1, 2, 3 ou 4
  time: number
  points: number
  audioUrl: null
}

export interface PrepackagedQuiz {
  id: string
  name: string
  emoji: string
  description: string
  questions: PrepackagedQuestion[]
}

export const prepackagedQuizzes: PrepackagedQuiz[] = [
  {
    id: 'disney',
    name: 'Disney',
    emoji: '🦁',
    description: 'Les classiques Disney pour petits et grands',
    questions: [
      {
        question: "Comment s'appelle le père de Simba dans Le Roi Lion ?",
        answers: ["Scar", "Mufasa", "Rafiki", "Zazu"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel est le nom du bonhomme de neige dans La Reine des Neiges ?",
        answers: ["Sven", "Kristoff", "Olaf", "Hans"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Dans quel film Disney chante-t-on 'Hakuna Matata' ?",
        answers: ["Aladdin", "Le Roi Lion", "Tarzan", "Hercule"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Comment s'appelle la fée dans Peter Pan ?",
        answers: ["Maléfique", "Clochette", "Marraine", "Viviane"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel animal est Dumbo ?",
        answers: ["Un souriceau", "Un éléphant", "Un faon", "Un lionceau"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui est le méchant dans Le Livre de la Jungle ?",
        answers: ["Baloo", "Bagheera", "Shere Khan", "Kaa"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Comment s'appelle le poisson ami de Némo ?",
        answers: ["Dory", "Marin", "Gill", "Bubulle"],
        correctAnswer: 1,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel objet magique possède Aladdin ?",
        answers: ["Un tapis volant", "Une baguette", "Un miroir", "Une cape"],
        correctAnswer: 1,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Comment s'appelle le prince dans La Belle et la Bête ?",
        answers: ["Philippe", "Adam", "Gaston", "Henri"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quelle princesse a des cheveux magiques de 20 mètres ?",
        answers: ["Cendrillon", "Aurore", "Raiponce", "Ariel"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Dans Toy Story, quel est le nom du cow-boy ?",
        answers: ["Buzz", "Woody", "Rex", "Jessie"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui chante 'Libérée, Délivrée' en VF ?",
        answers: ["Céline Dion", "Anaïs Delva", "Louane", "Jenifer"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel Disney se passe à Paris ?",
        answers: ["Les Aristochats", "Ratatouille", "Le Bossu de Notre-Dame", "Les trois"],
        correctAnswer: 4,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Comment s'appelle le crabe dans La Petite Sirène ?",
        answers: ["Sébastien", "Polochon", "Eurêka", "Maître Nageur"],
        correctAnswer: 1,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel personnage dit 'Ohana signifie famille' ?",
        answers: ["Nani", "Lilo", "Stitch", "Jumba"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      }
    ]
  },
  {
    id: 'annees80',
    name: 'Années 80',
    emoji: '🎤',
    description: 'Culture française des eighties',
    questions: [
      {
        question: "Quel groupe chante 'L'Aventurier' ?",
        answers: ["Téléphone", "Indochine", "Gold", "Niagara"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quelle émission jeunesse était présentée par Dorothée ?",
        answers: ["Récré A2", "Club Dorothée", "Les Minikeums", "Téléchat"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui chante 'Les Démons de Minuit' ?",
        answers: ["Début de Soirée", "Images", "Partenaire Particulier", "Cookie Dingler"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel groupe chante 'Nuit de Folie' ?",
        answers: ["Début de Soirée", "Gold", "Les Avions", "Lio"],
        correctAnswer: 1,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "En quelle année est sorti 'La Boum' avec Sophie Marceau ?",
        answers: ["1978", "1980", "1982", "1984"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui interprète 'Pour que tu m'aimes encore' ?",
        answers: ["Patricia Kaas", "Mylène Farmer", "Céline Dion", "Vanessa Paradis"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel dessin animé mettait en scène des chats robots ?",
        answers: ["Goldorak", "Les Chevaliers du Zodiaque", "Cat's Eyes", "Albator"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui chante 'Ella, elle l'a' ?",
        answers: ["Lio", "France Gall", "Jeanne Mas", "Desireless"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel film a révélé Jean-Claude Van Damme en France ?",
        answers: ["Bloodsport", "Kickboxer", "Timecop", "Double Impact"],
        correctAnswer: 1,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui présentait 'La Roue de la Fortune' ?",
        answers: ["Patrick Sabatier", "Michel Drucker", "Christian Morin", "Jean-Pierre Foucault"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel groupe chante 'Voyage Voyage' ?",
        answers: ["Niagara", "Desireless", "Lio", "Jeanne Mas"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Comment s'appelait le présentateur du 'Juste Prix' ?",
        answers: ["Vincent Lagaf", "Patrick Roy", "Philippe Risoli", "Patrice Laffont"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui chante 'Désenchantée' ?",
        answers: ["Patricia Kaas", "Mylène Farmer", "Vanessa Paradis", "Jeanne Mas"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel héros de dessin animé pilotait un robot géant appelé Goldorak ?",
        answers: ["Albator", "Actarus", "Cobra", "Ken le Survivant"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel duo comique a cartonné avec 'Le Père Noël est une ordure' ?",
        answers: ["Les Nuls", "Les Inconnus", "Le Splendid", "Les Charlots"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      }
    ]
  },
  {
    id: 'football',
    name: 'Football',
    emoji: '⚽',
    description: 'Le foot français et international',
    questions: [
      {
        question: "En quelle année la France a-t-elle gagné sa première Coupe du Monde ?",
        answers: ["1996", "1998", "2000", "2002"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui a marqué les 2 buts en finale 98 contre le Brésil ?",
        answers: ["Thierry Henry", "Zinédine Zidane", "David Trezeguet", "Youri Djorkaeff"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel joueur français a reçu un carton rouge en finale 2006 ?",
        answers: ["Ribéry", "Vieira", "Zidane", "Henry"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel club français a remporté la Ligue des Champions en 1993 ?",
        answers: ["PSG", "Monaco", "Lyon", "Marseille"],
        correctAnswer: 4,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Combien d'étoiles a l'équipe de France sur son maillot ?",
        answers: ["1", "2", "3", "4"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui est le meilleur buteur de l'histoire de l'équipe de France ?",
        answers: ["Platini", "Henry", "Griezmann", "Mbappé"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "En quelle année le PSG a-t-il été racheté par le Qatar ?",
        answers: ["2009", "2011", "2013", "2015"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel joueur est surnommé 'Le Président' ?",
        answers: ["Deschamps", "Thuram", "Blanc", "Platini"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui a inscrit le but en or à l'Euro 2000 ?",
        answers: ["Zidane", "Henry", "Trezeguet", "Wiltord"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Dans quel stade s'est jouée la finale de la Coupe du Monde 98 ?",
        answers: ["Parc des Princes", "Vélodrome", "Stade de France", "Geoffroy-Guichard"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel gardien français a remporté la Coupe du Monde 2018 ?",
        answers: ["Mandanda", "Lloris", "Areola", "Maignan"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui est le sélectionneur de l'équipe de France depuis 2012 ?",
        answers: ["Domenech", "Blanc", "Deschamps", "Jacquet"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Combien de buts Mbappé a-t-il marqué en finale 2022 ?",
        answers: ["1", "2", "3", "4"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel joueur français a gagné 3 Ballons d'Or ?",
        answers: ["Zidane", "Platini", "Henry", "Papin"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Contre quelle équipe la France a-t-elle perdu la finale 2022 ?",
        answers: ["Brésil", "Allemagne", "Argentine", "Croatie"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      }
    ]
  },
  {
    id: 'films-francais',
    name: 'Films Français',
    emoji: '🎬',
    description: 'Les films cultes du cinéma français',
    questions: [
      {
        question: "Qui joue Jacquouille dans Les Visiteurs ?",
        answers: ["Jean Reno", "Christian Clavier", "Gérard Depardieu", "Thierry Lhermitte"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Dans quel film entend-on 'C'est cela, oui' ?",
        answers: ["Les Visiteurs", "Le Père Noël est une ordure", "Le Dîner de Cons", "Les Bronzés"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui a réalisé le film Intouchables ?",
        answers: ["Luc Besson", "Olivier Nakache et Éric Toledano", "Jean-Pierre Jeunet", "Claude Zidi"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel acteur joue François Pignon dans Le Dîner de Cons ?",
        answers: ["Thierry Lhermitte", "Jacques Villeret", "Daniel Auteuil", "Pierre Richard"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Combien d'entrées pour Bienvenue chez les Ch'tis ?",
        answers: ["10 millions", "15 millions", "20 millions", "25 millions"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui joue le rôle de Driss dans Intouchables ?",
        answers: ["Jamel Debbouze", "Omar Sy", "Dany Boon", "Kad Merad"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Dans quel film trouve-t-on le personnage de Brice de Nice ?",
        answers: ["Camping", "Brice de Nice", "Les Bronzés 3", "RRRrrrr!!!"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui est le réalisateur d'Amélie Poulain ?",
        answers: ["Luc Besson", "Jean-Pierre Jeunet", "Mathieu Kassovitz", "Michel Gondry"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel acteur joue OSS 117 ?",
        answers: ["Gad Elmaleh", "Jean Dujardin", "Dany Boon", "Guillaume Canet"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quelle troupe a joué Le Père Noël est une ordure ?",
        answers: ["Les Nuls", "Les Inconnus", "Le Splendid", "Les Charlots"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui joue le rôle de Léon dans le film de Luc Besson ?",
        answers: ["Gérard Depardieu", "Jean Reno", "Vincent Cassel", "Benoît Poelvoorde"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "En quelle année est sorti La Grande Vadrouille ?",
        answers: ["1962", "1964", "1966", "1968"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui joue Astérix dans Mission Cléopâtre ?",
        answers: ["Gérard Depardieu", "Christian Clavier", "Jamel Debbouze", "Édouard Baer"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel duo comique joue dans La Cité de la Peur ?",
        answers: ["Le Splendid", "Les Inconnus", "Les Nuls", "Éric et Ramzy"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui réalise le film Taxi ?",
        answers: ["Luc Besson", "Gérard Pirès", "Olivier Marchal", "Claude Zidi"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      }
    ]
  },
  {
    id: 'mariage',
    name: 'Mariage',
    emoji: '💒',
    description: 'Traditions et fun autour du mariage',
    questions: [
      {
        question: "Que lance-t-on traditionnellement à la sortie de l'église ?",
        answers: ["Des pétales", "Du riz", "Des confettis", "Des ballons"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quelle est la couleur traditionnelle de la robe de mariée ?",
        answers: ["Rouge", "Bleu", "Blanc", "Rose"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Que fait traditionnellement la mariée avec son bouquet ?",
        answers: ["Elle le garde", "Elle le lance", "Elle le donne à sa mère", "Elle le met dans un vase"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel doigt porte l'alliance en France ?",
        answers: ["Index gauche", "Annulaire gauche", "Majeur droit", "Annulaire droit"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Comment appelle-t-on le repas de mariage ?",
        answers: ["Le festin", "Le banquet", "La réception", "Le vin d'honneur"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Qui accompagne traditionnellement la mariée à l'autel ?",
        answers: ["Sa mère", "Son père", "Son témoin", "Le marié"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Combien d'années de mariage pour les noces d'or ?",
        answers: ["25 ans", "40 ans", "50 ans", "60 ans"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Que représentent les noces de coton ?",
        answers: ["1 an", "2 ans", "5 ans", "10 ans"],
        correctAnswer: 1,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quelle danse ouvre traditionnellement le bal ?",
        answers: ["La valse", "Le rock", "Le tango", "La salsa"],
        correctAnswer: 1,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quel objet bleu la mariée doit-elle porter selon la tradition ?",
        answers: ["Une bague", "Un collier", "Quelque chose de bleu", "Des chaussures"],
        correctAnswer: 3,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Comment s'appelle le discours du témoin ?",
        answers: ["Le toast", "Le speech", "L'éloge", "La déclaration"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Quelle pièce du gâteau les mariés coupent-ils ensemble ?",
        answers: ["La première part", "Le sommet", "La base", "N'importe laquelle"],
        correctAnswer: 1,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Comment appelle-t-on la voiture des mariés décorée ?",
        answers: ["La calèche", "Le carrosse", "La voiture balai", "La voiture des mariés"],
        correctAnswer: 4,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Combien d'années pour les noces d'argent ?",
        answers: ["10 ans", "15 ans", "20 ans", "25 ans"],
        correctAnswer: 4,
        time: 20,
        points: 10,
        audioUrl: null
      },
      {
        question: "Que crie-t-on quand les mariés s'embrassent ?",
        answers: ["Bravo !", "Vive les mariés !", "Encore !", "Félicitations !"],
        correctAnswer: 2,
        time: 20,
        points: 10,
        audioUrl: null
      }
    ]
  }
]
