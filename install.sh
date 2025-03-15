#!/bin/bash

# Met à jour le système et installe les dépendances nécessaires
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nodejs npm

# Définition des chemins
INSTALL_DIR="/opt/athc"
COMMAND_PATH="/usr/local/bin/athc"

# Supprime l'ancienne installation si elle existe
sudo rm -rf $INSTALL_DIR
sudo rm -f $COMMAND_PATH

# Clone le projet et entre dans le dossier
git clone https://github.com/evrardamoussouga/asin-take-home-challenge.git /tmp/asin-take-home-challenge
cd /tmp/asin-take-home-challenge

# Installe les dépendances du projet
npm install
npm run build

# Déplace les fichiers nécessaires dans /opt/
sudo mv /tmp/asin-take-home-challenge $INSTALL_DIR

# Crée un script global pour exécuter la commande
echo "#!/bin/bash" | sudo tee $COMMAND_PATH > /dev/null
echo "node $INSTALL_DIR/ace athc \"\$@\"" | sudo tee -a $COMMAND_PATH > /dev/null
sudo chmod +x $COMMAND_PATH

# Nettoie le dossier temporaire
rm -rf /tmp/asin-take-home-challenge

echo "Installation terminée ! Vous pouvez maintenant exécuter la commande : athc [options]"
