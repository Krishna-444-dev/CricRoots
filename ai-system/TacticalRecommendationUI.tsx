import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Divider, 
  Chip,
  Tabs,
  Tab,
  Button,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar
} from '@mui/material';
import { 
  Menu as MenuIcon,
  SportsCricket as SportsCricketIcon,
  Person as PersonIcon,
  Speed as SpeedIcon,
  Explore as ExploreIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Help as HelpIcon
} from '@mui/icons-material';

// Import recommendation components
import BatsmanRecommendation from './BatsmanRecommendation';
import BowlerRecommendation from './BowlerRecommendation';
import FieldingPositionOptimization from './FieldingPositionOptimization';

// Import types
import { PlayerStats, MatchData } from '../data/types';

// Define tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tactical-tabpanel-${index}`}
      aria-labelledby={`tactical-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// Tab props
const a11yProps = (index: number) => {
  return {
    id: `tactical-tab-${index}`,
    'aria-controls': `tactical-tabpanel-${index}`,
  };
};

// Match phases
const MATCH_PHASES = [
  'Pre-match planning',
  'Powerplay (1-6 overs)',
  'Middle overs (7-15)',
  'Death overs (16-20)',
  'Post-match analysis'
];

// Main tactical recommendation UI component
const TacticalRecommendationUI: React.FC = () => {
  // State for UI
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [matchPhase, setMatchPhase] = useState<string>(MATCH_PHASES[0]);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{open: boolean, message: string, severity: 'success' | 'info' | 'warning' | 'error'}>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // Toggle drawer
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };
  
  // Handle match phase change
  const handleMatchPhaseChange = (event: any) => {
    setMatchPhase(event.target.value);
    
    // Show loading indicator
    setIsLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      setIsLoading(false);
      
      // Show notification
      setNotification({
        open: true,
        message: `Recommendations updated for ${event.target.value} phase`,
        severity: 'success'
      });
    }, 1500);
  };
  
  // Toggle live mode
  const toggleLiveMode = () => {
    setIsLive(!isLive);
    
    // Show notification
    setNotification({
      open: true,
      message: !isLive ? 'Live recommendations activated' : 'Live recommendations paused',
      severity: !isLive ? 'info' : 'warning'
    });
  };
  
  // Handle notification close
  const handleNotificationClose = () => {
    setNotification({
      ...notification,
      open: false
    });
  };
  
  // Refresh recommendations
  const refreshRecommendations = () => {
    // Show loading indicator
    setIsLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      setIsLoading(false);
      
      // Show notification
      setNotification({
        open: true,
        message: 'Recommendations refreshed with latest data',
        severity: 'success'
      });
    }, 1500);
  };
  
  // Save current plan
  const savePlan = () => {
    // Show notification
    setNotification({
      open: true,
      message: 'Tactical plan saved successfully',
      severity: 'success'
    });
  };
  
  // Render drawer content
  const renderDrawerContent = () => (
    <Box
      sx={{ width: 250 }}
      role="presentation"
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
        <SportsCricketIcon sx={{ mr: 1 }} />
        <Typography variant="h6">
          Cricket Tactics AI
        </Typography>
      </Box>
      <Divider />
      <List>
        <ListItem button selected={activeTab === 0} onClick={() => setActiveTab(0)}>
          <ListItemIcon>
            <DashboardIcon />
          </ListItemIcon>
          <ListItemText primary="Dashboard" />
        </ListItem>
        <ListItem button selected={activeTab === 1} onClick={() => setActiveTab(1)}>
          <ListItemIcon>
            <PersonIcon />
          </ListItemIcon>
          <ListItemText primary="Batsman" />
        </ListItem>
        <ListItem button selected={activeTab === 2} onClick={() => setActiveTab(2)}>
          <ListItemIcon>
            <SpeedIcon />
          </ListItemIcon>
          <ListItemText primary="Bowler" />
        </ListItem>
        <ListItem button selected={activeTab === 3} onClick={() => setActiveTab(3)}>
          <ListItemIcon>
            <ExploreIcon />
          </ListItemIcon>
          <ListItemText primary="Fielding" />
        </ListItem>
      </List>
      <Divider />
      <List>
        <ListItem button>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItem>
        <ListItem button>
          <ListItemIcon>
            <HelpIcon />
          </ListItemIcon>
          <ListItemText primary="Help" />
        </ListItem>
      </List>
    </Box>
  );
  
  // Render dashboard content
  const renderDashboard = () => (
    <Box>
      <Typography variant="h5" gutterBottom>
        Tactical Recommendation Dashboard
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Comprehensive match planning and in-game decision support
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Match Phase Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Match Phase
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                <InputLabel id="match-phase-label">Current Match Phase</InputLabel>
                <Select
                  labelId="match-phase-label"
                  id="match-phase-select"
                  value={matchPhase}
                  onChange={handleMatchPhaseChange}
                  label="Current Match Phase"
                >
                  {MATCH_PHASES.map((phase) => (
                    <MenuItem key={phase} value={phase}>{phase}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isLive}
                      onChange={toggleLiveMode}
                      color="primary"
                    />
                  }
                  label="Live Recommendations"
                />
                
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={refreshRecommendations}
                  disabled={isLoading}
                >
                  Refresh
                </Button>
              </Box>
              
              {isLive && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Live recommendations are active. Updates will be provided automatically as match situation changes.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Key Recommendations Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Key Recommendations
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {isLoading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
                  <CircularProgress size={40} sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Analyzing match situation...
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Next Batsman
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                          <Typography variant="body1">
                            Virat Kohli
                          </Typography>
                        </Box>
                        <Chip label="92% confidence" color="success" size="small" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Strong against current bowlers with excellent middle overs record
                      </Typography>
                    </Paper>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Next Bowler
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <SpeedIcon sx={{ mr: 1, color: 'secondary.main' }} />
                          <Typography variant="body1">
                            Jasprit Bumrah
                          </Typography>
                        </Box>
                        <Chip label="87% confidence" color="success" size="small" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Strong matchup against current batsmen with excellent death bowling
                      </Typography>
                    </Paper>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Field Setting
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <ExploreIcon sx={{ mr: 1, color: 'info.main' }} />
                          <Typography variant="body1">
                            Attacking Off-Side Field
                          </Typography>
                        </Box>
                        <Chip label="High priority" color="warning" size="small" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Optimized for batsman's off-side scoring tendency with current bowler
                      </Typography>
                    </Paper>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Match Strategy Card */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Match Strategy Plan
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stepper orientation="vertical" sx={{ mb: 2 }}>
                <Step active completed>
                  <StepLabel>Powerplay (1-6 overs)</StepLabel>
                  <StepContent>
                    <Typography variant="body2">
                      Focus on containing runs with pace bowlers. Use slip fielders and maintain tight lines.
                      Target opposition's top order with specific matchups.
                    </Typography>
                  </StepContent>
                </Step>
                <Step active>
                  <StepLabel>Middle Overs (7-15)</StepLabel>
                  <StepContent>
                    <Typography variant="body2">
                      Introduce spin bowlers to control run rate. Set defensive field with focus on preventing
                      boundaries. Target batsmen with specific weaknesses against spin.
                    </Typography>
                  </StepContent>
                </Step>
                <Step>
                  <StepLabel>Death Overs (16-20)</StepLabel>
                  <StepContent>
                    <Typography variant="body2">
                      Return to pace bowlers with yorker capability. Set field for defensive shots and
                      potential catches in the deep. Focus on limiting boundaries.
                    </Typography>
                  </StepContent>
                </Step>
              </Stepper>
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={savePlan}
                  sx={{ mr: 1 }}
                >
                  Save Plan
                </Button>
                <Button
                  variant="outlined"
                  startIcon={isLive ? <PauseIcon /> : <PlayArrowIcon />}
                  onClick={toggleLiveMode}
                  color={isLive ? 'warning' : 'success'}
                >
                  {isLive ? 'Pause Live Updates' : 'Start Live Updates'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
  
  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={toggleDrawer}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <SportsCricketIcon sx={{ mr: 1 }} />
          <Typography variant="h6" noWrap component="div">
            Cricket Tactical Recommendation System
          </Typography>
          
          <Box sx={{ flexGrow: 1 }} />
          
          {isLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
              <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
              <Typography variant="body2">
                Updating...
              </Typography>
            </Box>
          )}
          
          {isLive && (
            <Chip 
              label="Live Recommendations" 
              color="error" 
              size="small" 
              icon={<PlayArrowIcon />} 
              sx={{ mr: 2 }}
            />
          )}
          
          <Button 
            color="inherit" 
            startIcon={<RefreshIcon />}
            onClick={refreshRecommendations}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Toolbar>
      </AppBar>
      
      {/* Drawer */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={toggleDrawer}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
      >
        {renderDrawerContent()}
      </Drawer>
      
      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: '100%',
          mt: 8 // Space for AppBar
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            aria-label="tactical recommendation tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Dashboard" {...a11yProps(0)} />
            <Tab label="Batsman Recommendations" {...a11yProps(1)} />
            <Tab label="Bowler Recommendations" {...a11yProps(2)} />
            <Tab label="Fielding Optimization" {...a11yProps(3)} />
          </Tabs>
        </Box>
        
        <TabPanel value={activeTab} index={0}>
          {renderDashboard()}
        </TabPanel>
        
        <TabPanel value={activeTab} index={1}>
          <BatsmanRecommendation />
        </TabPanel>
        
        <TabPanel value={activeTab} index={2}>
          <BowlerRecommendation />
        </TabPanel>
        
        <TabPanel value={activeTab} index={3}>
          <FieldingPositionOptimization />
        </TabPanel>
      </Box>
      
      {/* Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleNotificationClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleNotificationClose} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TacticalRecommendationUI;
